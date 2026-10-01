import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { extractTextFromPdf } from "@/lib/ai/pdf-parser"
import { extractQuestionsFromText } from "@/lib/ai/question-generator"
import {
  BULK_BATCH_SIZE,
  BULK_TX_OPTIONS,
  runBatched,
} from "@/lib/bulk-import"
import type { ExtractedQuestion } from "@/lib/ai/question-generator"

export const runtime = "nodejs"
export const maxDuration = 120

type Params = { params: Promise<{ id: string }> }

interface TopicMatch {
  topicId: string
  topicTitle: string
  questions: ExtractedQuestion[]
}

export async function POST(request: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id: moduleId } = await params

  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "PDF file is required" },
        { status: 400 }
      )
    }

    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      )
    }

    // Verify module exists
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        chapters: {
          include: {
            topics: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    })

    if (!module) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 })
    }

    // Extract text from PDF
    const buffer = Buffer.from(await file.arrayBuffer())
    const text = await extractTextFromPdf(buffer)

    // Extract questions using AI
    const { questions } = await extractQuestionsFromText(text)

    if (questions.length === 0) {
      return NextResponse.json(
        { error: "No questions could be extracted from the textbook" },
        { status: 400 }
      )
    }

    // Get all topics in this module for matching
    const allTopics = module.chapters.flatMap((chapter) =>
      chapter.topics.map((topic) => ({
        id: topic.id,
        title: topic.title.toLowerCase(),
      }))
    )

    // Match questions to topics based on keyword similarity
    const topicMatches = new Map<string, TopicMatch>()
    const unmatchedQuestions: ExtractedQuestion[] = []

    for (const question of questions) {
      const questionText = question.question.toLowerCase()
      let matched = false

      // Try to find a matching topic based on keywords
      for (const topic of allTopics) {
        // Check if topic title appears in question or vice versa
        const topicKeywords = topic.title.split(/\s+/)
        const hasKeywordMatch = topicKeywords.some(
          (keyword) =>
            keyword.length > 3 && questionText.includes(keyword)
        )

        if (hasKeywordMatch) {
          if (!topicMatches.has(topic.id)) {
            topicMatches.set(topic.id, {
              topicId: topic.id,
              topicTitle: topic.title,
              questions: [],
            })
          }
          topicMatches.get(topic.id)!.questions.push(question)
          matched = true
          break
        }
      }

      if (!matched) {
        unmatchedQuestions.push(question)
      }
    }

    // Create questions for matched topics only
    const createdQuestions: { topicId: string; count: number }[] = []

    for (const [topicId, match] of topicMatches) {
      const created = await runBatched(
        match.questions,
        BULK_BATCH_SIZE,
        (batch) =>
          prisma.$transaction(
            batch.map((q) =>
              prisma.question.create({
                data: {
                  topicId,
                  question: q.question,
                  difficulty: "medium",
                  answers: {
                    create: q.options.map((answer) => ({
                      answer,
                      isCorrect: answer === q.correctOption,
                    })),
                  },
                },
              })
            ),
            BULK_TX_OPTIONS
          )
      )

      createdQuestions.push({
        topicId,
        count: created.length,
      })
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalExtracted: questions.length,
        matchedTopics: topicMatches.size,
        uploadedQuestions: createdQuestions.reduce(
          (sum, t) => sum + t.count,
          0
        ),
        skippedQuestions: unmatchedQuestions.length,
      },
      details: {
        matchedTopics: Array.from(topicMatches.values()).map((match) => ({
          topicId: match.topicId,
          topicTitle: match.topicTitle,
          questionsUploaded: match.questions.length,
        })),
        skippedQuestionsCount: unmatchedQuestions.length,
      },
    })
  } catch (err) {
    console.error("Textbook upload error:", err)
    const message =
      err instanceof Error ? err.message : "Failed to process textbook"
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
