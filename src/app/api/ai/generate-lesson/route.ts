import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { getOpenAIClient } from "@/lib/ai/openai"
import { moduleLines, readPdfText, UNISA_CONTEXT } from "@/lib/ai/unisa"
import { prisma } from "@/lib/prisma"

/**
 * POST { topicId, length?, notes? } → { html }
 *
 * Drafts the lesson for a topic using its module → chapter → topic context.
 * Every module in the app is a UNISA module, so the prompt is written for
 * UNISA's distance-learning students. The draft is returned to the editor
 * for the admin to review — nothing is saved here.
 */

export const runtime = "nodejs"
export const maxDuration = 120

type Length = "short" | "standard" | "detailed"

const LENGTH_GUIDE: Record<Length, string> = {
  short: "about 400–600 words",
  standard: "about 900–1,300 words",
  detailed: "about 1,800–2,500 words",
}

/** Max characters of PDF text sent to the model */
const PDF_TEXT_LIMIT = 40_000

const SYSTEM_PROMPT = `You are an experienced lecturer writing study material for students at UNISA (the University of South Africa).

${UNISA_CONTEXT}
- Define every technical term the first time it appears.

What to write: the lesson for ONE topic, written for the student ("you").
Structure:
1. A short opening paragraph: what this topic is and why it matters.
2. A "Key idea" box with the outcomes: what the student should be able to do after this topic.
3. The main teaching, split under clear headings (<h2>) and subheadings (<h3>), from basics to harder ideas, each with at least one worked example.
4. "Watch out" boxes for common mistakes students make in exams and assignments.
5. A short summary list at the end, then 2–4 self-check questions (questions only, no answers) under a heading "Check your understanding".

Formatting — return HTML using ONLY these tags: <h2> <h3> <p> <strong> <em> <ul> <ol> <li> <blockquote> <pre> <code> <table> <thead> <tbody> <tr> <th> <td> <hr> <div class="callout">, <div class="callout callout-tip">, <div class="callout callout-warning">.
- Callout boxes: <div class="callout"><p><strong>Key idea:</strong> …</p></div>, <div class="callout callout-tip"><p><strong>Tip:</strong> …</p></div>, <div class="callout callout-warning"><p><strong>Watch out:</strong> …</p></div>
- Code goes in <pre><code>…</code></pre> with < and > escaped as &lt; &gt;.
- Matrices: write them inline as [[1, 2], [3, 4]] (rows in brackets); the app draws them as matrices. Other maths: plain text such as x^2, √x, ≤, ×.
- No <h1> (the topic title is already shown), no inline styles, no images, no links, no markdown.

Respond with JSON only: { "html": "<the lesson HTML>" }`

export async function POST(request: Request) {
  try {
    // Inside the try so any failure (database, AI, PDFs) comes back as a readable JSON error
    const { error } = await requireAdmin()
    if (error) return error

    const body = (await request.json()) as { topicId?: string; length?: Length; notes?: string }
    const { topicId } = body
    const length: Length = body.length && body.length in LENGTH_GUIDE ? body.length : "standard"
    const notes = body.notes?.trim().slice(0, 2000) ?? ""

    if (!topicId) {
      return NextResponse.json({ error: "topicId is required" }, { status: 400 })
    }

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      select: {
        id: true,
        title: true,
        order: true,
        chapterId: true,
        pdfs: { select: { title: true, url: true }, orderBy: { createdAt: "asc" } },
        questions: {
          take: 15,
          select: { question: true, answers: { where: { isCorrect: true }, select: { answer: true } } },
        },
        chapter: {
          select: {
            id: true,
            title: true,
            topics: { orderBy: { order: "asc" }, select: { id: true, title: true } },
            module: {
              select: {
                title: true,
                description: true,
                chapters: { orderBy: { order: "asc" }, select: { id: true, title: true } },
              },
            },
          },
        },
      },
    })
    if (!topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 })
    }

    const mod = topic.chapter.module
    const chapterNo = mod.chapters.findIndex(c => c.id === topic.chapter.id) + 1
    const topicNo = topic.chapter.topics.findIndex(t => t.id === topic.id) + 1

    // Text from this topic's PDFs (study guide pages etc.) to ground the lesson
    const pdfText = await readPdfText(topic.pdfs, PDF_TEXT_LIMIT)

    const otherTopics = topic.chapter.topics
      .map((t, i) => `${chapterNo}.${i + 1} ${t.title}${t.id === topic.id ? "  ← THIS TOPIC" : ""}`)
      .join("\n")

    const quizLines = topic.questions
      .map(q => `- ${q.question}${q.answers[0] ? ` (answer: ${q.answers[0].answer})` : ""}`)
      .join("\n")

    const userPrompt = [
      ...moduleLines(mod),
      `Chapter ${chapterNo}: ${topic.chapter.title}`,
      `Topic ${chapterNo}.${topicNo}: ${topic.title}`,
      "",
      "Topics in this chapter (teach only THIS topic; you may briefly refer to the others but don't teach them):",
      otherTopics,
      quizLines ? `\nThe topic's quiz asks questions like these, so the lesson must prepare students to answer them:\n${quizLines}` : "",
      pdfText
        ? `\nSource material uploaded for this topic (base the lesson on it; it takes priority over general knowledge):\n${pdfText}`
        : "\nNo source material was uploaded for this topic — use standard content for this UNISA module at this level.",
      notes ? `\nInstructions from the lecturer: ${notes}` : "",
      "",
      `Length: ${LENGTH_GUIDE[length]}.`,
    ]
      .filter(line => line !== "")
      .join("\n")

    const openai = getOpenAIClient()
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    })

    const raw = response.choices[0]?.message?.content
    if (!raw) throw new Error("No response from AI")

    const parsed = JSON.parse(raw) as { html?: unknown }
    const html = typeof parsed.html === "string"
      ? parsed.html.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/, "").trim()
      : ""
    if (!html) throw new Error("The AI didn't return any lesson content")

    return NextResponse.json({
      html,
      usedPdfs: pdfText ? topic.pdfs.length : 0,
    })
  } catch (err) {
    console.error("Generate lesson error:", err)
    const message = err instanceof Error ? err.message : "Failed to write the lesson"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
