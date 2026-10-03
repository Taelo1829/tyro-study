import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { moduleLines, readPdfText } from "@/lib/ai/unisa"
import { LENGTH_GUIDE, type Length, writeLessonHtml } from "@/lib/ai/writers"
import { prisma } from "@/lib/prisma"

/**
 * POST { topicId, length?, notes? } → { html }
 *
 * Drafts the lesson for a topic using its module → chapter → topic context.
 * Every module in the app is a UNISA module, so the prompt is written for
 * UNISA's distance-learning students. The draft is returned to the editor
 * for the admin to review - nothing is saved here.
 */

export const runtime = "nodejs"
export const maxDuration = 120

/** Max characters of PDF text sent to the model */
const PDF_TEXT_LIMIT = 40_000

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
        : "\nNo source material was uploaded for this topic. Use standard content for this UNISA module at this level.",
      notes ? `\nInstructions from the lecturer: ${notes}` : "",
      "",
      `Length: ${LENGTH_GUIDE[length]}.`,
    ]
      .filter(line => line !== "")
      .join("\n")

    const html = await writeLessonHtml(userPrompt)

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
