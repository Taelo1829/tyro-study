import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { htmlToText, moduleLines, readPdfText } from "@/lib/ai/unisa"
import { DIFFICULTY_GUIDE, type DifficultyChoice, writeQuestions } from "@/lib/ai/writers"

export type { GeneratedQuestion } from "@/lib/ai/writers"
import { prisma } from "@/lib/prisma"

/**
 * POST { topicId | chapterId, count?, difficulty?, notes? } → { questions }
 *
 * Drafts multiple-choice questions for a topic quiz or a chapter quiz, written
 * for UNISA students, using the module → chapter → topic context, the lesson
 * text and uploaded PDFs. Existing questions are passed in so the AI doesn't
 * repeat them. Nothing is saved here - the admin reviews the drafts first and
 * saves the ones they keep through POST /api/questions.
 */

export const runtime = "nodejs"
export const maxDuration = 120

const SOURCE_LIMIT = 45_000
const COUNTS = [5, 10, 15, 20] as const

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
        : "\nNo lesson or material has been added yet. Use standard content for this UNISA module at this level.",
      existing.length
        ? `\nExisting questions (do NOT repeat or closely rephrase these):\n${existing.slice(0, 150).map(q => `- ${q}`).join("\n")}`
        : "",
      notes ? `\nInstructions from the lecturer: ${notes}` : "",
    ]
      .filter(line => line !== "")
      .join("\n")

    const questions = await writeQuestions(userPrompt, existing, difficulty)
    if (questions.length === 0) throw new Error("The AI didn't return any usable questions. Try again")
    return NextResponse.json({ questions })
  } catch (err) {
    console.error("Generate questions error:", err)
    const message = err instanceof Error ? err.message : "Failed to generate questions"
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
