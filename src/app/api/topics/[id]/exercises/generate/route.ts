import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { generateTopicPractice } from "@/lib/ai/exercises"
import { getTopicCoding } from "@/lib/coding"
import { countExercises } from "@/lib/exercises"

export const runtime = "nodejs"
export const maxDuration = 120

const clamp = (v: unknown, fallback: number, max: number) => {
  const n = v === undefined ? fallback : Math.floor(Number(v) || 0)
  return Math.max(0, Math.min(max, n))
}

/**
 * POST { exercises?, questions? } - the AI writes "Try it yourself" exercises
 * (default 2, at most 5) and type-the-answer quiz questions (default 5, at most 10)
 * → { exercises, questions } added
 *
 * With auto: true (after an AI lesson is saved) it only writes them for a topic
 * in a coding module that has no exercises yet → { skipped: true } otherwise.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireAdmin()
    if (error) return error
    const body = (await request.json().catch(() => ({}))) as { exercises?: unknown; questions?: unknown; auto?: unknown }
    const topicId = (await params).id
    if (body.auto === true) {
      const coding = await getTopicCoding(topicId)
      if (!coding?.language || (await countExercises(topicId)) > 0) return NextResponse.json({ skipped: true })
    }
    const added = await generateTopicPractice(topicId, {
      exercises: clamp(body.exercises, 2, 5),
      questions: clamp(body.questions, 5, 10),
    })
    return NextResponse.json(added)
  } catch (err) {
    console.error("Generate exercises error:", err)
    let message = err instanceof Error ? err.message : "Couldn't write the exercises"
    if (/topic_exercises|column .*kind/i.test(message)) message = "Exercises need the latest database update: run `npx prisma migrate deploy`."
    return NextResponse.json({ error: message }, { status: /OPENAI_API_KEY|migrate deploy/.test(message) ? 503 : 500 })
  }
}
