import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { getOpenAIClient } from "@/lib/ai/openai"
import { htmlToText, moduleLines, readPdfText, UNISA_CONTEXT } from "@/lib/ai/unisa"
import { prisma } from "@/lib/prisma"

/**
 * POST { topicId | chapterId, count?, difficulty?, notes? } → { questions }
 *
 * Drafts multiple-choice questions for a topic quiz or a chapter quiz, written
 * for UNISA students, using the module → chapter → topic context, the lesson
 * text and uploaded PDFs. Existing questions are passed in so the AI doesn't
 * repeat them. Nothing is saved here — the admin reviews the drafts first and
 * saves the ones they keep through POST /api/questions.
 */

export const runtime = "nodejs"
export const maxDuration = 120

type Difficulty = "easy" | "medium" | "hard"
type DifficultyChoice = Difficulty | "mixed"

export interface GeneratedQuestion {
  question: string
  options: string[]
  correctOption: string
  difficulty: Difficulty
  explanation?: string
}

const SOURCE_LIMIT = 45_000
const COUNTS = [5, 10, 15, 20] as const

const DIFFICULTY_GUIDE: Record<DifficultyChoice, string> = {
  mixed: "a mix: roughly 30% easy (recall and definitions), 50% medium (understanding and applying), 20% hard (analysing, tracing, multi-step problems)",
  easy: "easy: recall of facts, definitions and basic concepts",
  medium: "medium: understanding and applying concepts to short examples",
  hard: "hard: analysing, tracing code or working multi-step problems, distinguishing closely related ideas",
}

const SYSTEM_PROMPT = `You are an experienced UNISA lecturer and examiner writing multiple-choice questions for a module's online quizzes.

${UNISA_CONTEXT}

Write questions like a good UNISA MCQ assignment or exam paper:
- Each question tests ONE clear idea from the material and has exactly 4 options with exactly ONE correct answer.
- Wrong options (distractors) must be plausible — based on real misconceptions and common mistakes — not silly or obviously wrong. Keep all options a similar length and style.
- Do not use "All of the above", "None of the above" or "Both A and B". Avoid negative wording ("Which is NOT…") unless it is essential, and then write NOT in capitals.
- The question must make sense on its own (the quiz shows questions in random order) — don't refer to "the passage", "the text above" or other questions.
- Options are shuffled in the quiz, so never refer to option letters or positions.
- Code: put it in the question as plain text with line breaks (no markdown). Matrices: write them as [[1, 2], [3, 4]] — the app draws them as matrices.
- Cover the material broadly instead of asking several questions about the same detail, and never repeat or closely rephrase an existing question you are given.
- Give a one-sentence explanation of why the answer is correct.

Respond with JSON only:
{ "questions": [ { "question": "…", "options": ["…", "…", "…", "…"], "correctOption": "exact text of the correct option", "difficulty": "easy" | "medium" | "hard", "explanation": "…" } ] }`

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

export async function POST(request: Request) {
  try {
    // Inside the try so any failure (database, AI, PDFs) comes back as a readable JSON error
    const { error } = await requireAdmin()
    if (error) return error

    const body = (await request.json()) as {
      topicId?: string
      chapterId?: string
      count?: number
      difficulty?: DifficultyChoice
      notes?: string
    }
    const count = COUNTS.includes(body.count as (typeof COUNTS)[number]) ? (body.count as number) : 10
    const difficulty: DifficultyChoice = body.difficulty && body.difficulty in DIFFICULTY_GUIDE ? body.difficulty : "mixed"
    const notes = body.notes?.trim().slice(0, 2000) ?? ""

    if (!body.topicId && !body.chapterId) {
      return NextResponse.json({ error: "topicId or chapterId is required" }, { status: 400 })
    }

    const moduleSelect = {
      title: true,
      description: true,
      chapters: { orderBy: { order: "asc" as const }, select: { id: true } },
    }
    const existingSelect = { select: { question: true }, take: 200 }

    let contextLines: string[]
    let source: string
    let existing: string[]
    let scope: string

    if (body.topicId) {
      const topic = await prisma.topic.findUnique({
        where: { id: body.topicId },
        select: {
          id: true,
          title: true,
          content: true,
          pdfs: { select: { title: true, url: true }, orderBy: { createdAt: "asc" } },
          questions: existingSelect,
          chapter: {
            select: {
              id: true,
              title: true,
              topics: { orderBy: { order: "asc" }, select: { id: true, title: true } },
              module: { select: moduleSelect },
            },
          },
        },
      })
      if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 })

      const chapterNo = topic.chapter.module.chapters.findIndex(c => c.id === topic.chapter.id) + 1
      const topicNo = topic.chapter.topics.findIndex(t => t.id === topic.id) + 1
      scope = `the topic quiz for topic ${chapterNo}.${topicNo}`
      contextLines = [
        ...moduleLines(topic.chapter.module),
        `Chapter ${chapterNo}: ${topic.chapter.title}`,
        `Topic ${chapterNo}.${topicNo}: ${topic.title}`,
        "Ask only about THIS topic.",
      ]
      const lesson = htmlToText(topic.content)
      const pdfText = await readPdfText(topic.pdfs, Math.max(0, SOURCE_LIMIT - lesson.length))
      source = [lesson && `Lesson:\n${lesson}`, pdfText && `Uploaded material:\n${pdfText}`].filter(Boolean).join("\n\n")
      existing = topic.questions.map(q => q.question)
    } else {
      const chapter = await prisma.chapter.findUnique({
        where: { id: body.chapterId },
        select: {
          id: true,
          title: true,
          questions: existingSelect,
          topics: {
            orderBy: { order: "asc" },
            select: { title: true, content: true, questions: existingSelect },
          },
          module: { select: moduleSelect },
        },
      })
      if (!chapter) return NextResponse.json({ error: "Chapter not found" }, { status: 404 })

      const chapterNo = chapter.module.chapters.findIndex(c => c.id === chapter.id) + 1
      scope = `the chapter ${chapterNo} quiz (spread the questions across all its topics, including some that connect topics)`
      contextLines = [
        ...moduleLines(chapter.module),
        `Chapter ${chapterNo}: ${chapter.title}`,
        "Topics in this chapter:",
        ...chapter.topics.map((t, i) => `${chapterNo}.${i + 1} ${t.title}`),
      ]
      // Each topic's lesson, sharing the space fairly
      const perTopic = Math.floor(SOURCE_LIMIT / Math.max(1, chapter.topics.length))
      source = chapter.topics
        .map((t, i) => {
          const text = htmlToText(t.content).slice(0, perTopic)
          return text ? `--- Topic ${chapterNo}.${i + 1} ${t.title} ---\n${text}` : ""
        })
        .filter(Boolean)
        .join("\n\n")
      existing = [...chapter.questions, ...chapter.topics.flatMap(t => t.questions)].map(q => q.question)
    }

    const userPrompt = [
      ...contextLines,
      "",
      `Write ${count} multiple-choice questions for ${scope}.`,
      `Difficulty: ${DIFFICULTY_GUIDE[difficulty]}.`,
      source
        ? `\nBase the questions on this material (it takes priority over general knowledge):\n${source}`
        : "\nNo lesson or material has been added yet — use standard content for this UNISA module at this level.",
      existing.length
        ? `\nExisting questions — do NOT repeat or closely rephrase these:\n${existing.slice(0, 150).map(q => `- ${q}`).join("\n")}`
        : "",
      notes ? `\nInstructions from the lecturer: ${notes}` : "",
    ]
      .filter(line => line !== "")
      .join("\n")

    const openai = getOpenAIClient()
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    })

    const raw = response.choices[0]?.message?.content
    if (!raw) throw new Error("No response from AI")
    const parsed = JSON.parse(raw) as { questions?: unknown }
    if (!Array.isArray(parsed.questions)) throw new Error("Invalid AI response")

    // Keep only well-formed questions that aren't duplicates
    const seen = new Set(existing.map(normalise))
    const questions: GeneratedQuestion[] = []
    for (const item of parsed.questions as Record<string, unknown>[]) {
      const question = typeof item?.question === "string" ? item.question.trim() : ""
      const options = Array.isArray(item?.options)
        ? [...new Set(item.options.map(o => String(o).trim()).filter(Boolean))]
        : []
      const correctOption = typeof item?.correctOption === "string" ? item.correctOption.trim() : ""
      const level = ["easy", "medium", "hard"].includes(String(item?.difficulty))
        ? (item.difficulty as Difficulty)
        : difficulty === "mixed" ? "medium" : difficulty
      const key = normalise(question)
      if (!question || options.length < 2 || !options.includes(correctOption) || seen.has(key)) continue
      seen.add(key)
      questions.push({
        question,
        options,
        correctOption,
        difficulty: level,
        explanation: typeof item.explanation === "string" ? item.explanation.trim() : undefined,
      })
    }

    if (questions.length === 0) throw new Error("The AI didn't return any usable questions — try again")
    return NextResponse.json({ questions })
  } catch (err) {
    console.error("Generate questions error:", err)
    const message = err instanceof Error ? err.message : "Failed to generate questions"
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
