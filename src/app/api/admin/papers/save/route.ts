import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

/**
 * POST { moduleId, paper, questions: [{ question, options, correctOption, difficulty, topicId }] }
 * Saves the reviewed paper questions into their topics, marked with the
 * paper's name (the mock exam asks these first). A question a topic already
 * has (same wording) is skipped.
 */

export const runtime = "nodejs"
export const maxDuration = 120

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = (await request.json().catch(() => ({}))) as { moduleId?: unknown; paper?: unknown; questions?: unknown }
  if (typeof body.moduleId !== "string") return NextResponse.json({ error: "moduleId is required" }, { status: 400 })
  const paper = typeof body.paper === "string" && body.paper.trim() ? body.paper.trim().slice(0, 120) : "Past paper"

  const topics = await prisma.topic.findMany({
    where: { chapter: { moduleId: body.moduleId } },
    select: { id: true, questions: { select: { question: true } } },
  })
  const existing = new Map(topics.map(t => [t.id, new Set(t.questions.map(q => norm(q.question)))]))

  let added = 0
  let skipped = 0
  for (const raw of (Array.isArray(body.questions) ? body.questions : []).slice(0, 300) as Record<string, unknown>[]) {
    const topicId = typeof raw?.topicId === "string" ? raw.topicId : ""
    const question = String(raw?.question ?? "").trim()
    const options = Array.isArray(raw?.options) ? [...new Set(raw.options.map(o => String(o).trim()).filter(Boolean))] : []
    const correct = String(raw?.correctOption ?? "").trim()
    if (!existing.has(topicId) || !question || options.length < 2 || !options.includes(correct)) {
      skipped++
      continue
    }
    if (existing.get(topicId)!.has(norm(question))) {
      skipped++
      continue
    }
    const created = await prisma.question.create({
      data: {
        topicId,
        question,
        difficulty: ["easy", "medium", "hard"].includes(String(raw.difficulty)) ? String(raw.difficulty) : "medium",
        answers: { create: options.map(answer => ({ answer, isCorrect: answer === correct })) },
      },
      select: { id: true },
    })
    try {
      await prisma.$executeRaw`UPDATE "questions" SET "paper" = ${paper} WHERE "id" = ${created.id}`
    } catch {
      // The question is saved; it just can't be marked as a past-paper question yet
      await prisma.question.delete({ where: { id: created.id } }).catch(() => {})
      return NextResponse.json(
        { error: "The database needs updating first: run `npx prisma migrate deploy`, then add the paper again.", added },
        { status: 503 }
      )
    }
    existing.get(topicId)!.add(norm(question))
    added++
  }
  return NextResponse.json({ added, skipped, paper })
}
