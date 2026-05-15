import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { getOpenAIClient } from "@/lib/ai/openai"
import { prisma } from "@/lib/prisma"
import { BULK_BATCH_SIZE } from "@/lib/bulk-import"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const body = await request.json()
    const { topicId, count = 10 } = body as { topicId?: string; count?: number }

    if (!topicId) {
      return NextResponse.json(
        { error: "topicId is required" },
        { status: 400 }
      )
    }

    const topic = await prisma.topic.findUnique({ where: { id: topicId } })
    if (!topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 })
    }

    const source = [topic.title, topic.content].filter(Boolean).join("\n\n")
    if (!source.trim()) {
      return NextResponse.json(
        { error: "Topic has no content to generate flashcards from" },
        { status: 400 }
      )
    }

    const openai = getOpenAIClient()
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Generate flashcards as JSON: { "flashcards": [{ "front": "string", "back": "string" }] }. Create ${count} concise cards.`,
        },
        {
          role: "user",
          content: `Create flashcards from:\n\n${source.slice(0, 50_000)}`,
        },
      ],
    })

    const raw = response.choices[0]?.message?.content
    if (!raw) throw new Error("No response from AI")

    const parsed = JSON.parse(raw) as {
      flashcards: { front: string; back: string }[]
    }
    if (!Array.isArray(parsed.flashcards)) {
      throw new Error("Invalid AI response")
    }

    const cards = parsed.flashcards
      .filter((c) => c.front?.trim() && c.back?.trim())
      .map((c) => ({
        topicId,
        front: c.front.trim(),
        back: c.back.trim(),
      }))

    let total = 0
    for (let i = 0; i < cards.length; i += BULK_BATCH_SIZE) {
      const batch = cards.slice(i, i + BULK_BATCH_SIZE)
      const result = await prisma.flashcard.createMany({ data: batch })
      total += result.count
    }

    return NextResponse.json({ count: total })
  } catch (err) {
    console.error("Generate flashcards error:", err)
    const message =
      err instanceof Error ? err.message : "Failed to generate flashcards"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
