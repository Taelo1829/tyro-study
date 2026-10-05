import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-session"
import { getTopicLock, lockedResponseBody } from "@/lib/topic-locks"
import { checkExercise, getExercise } from "@/lib/exercises"

/**
 * POST { answers: string[], reveal?: boolean }
 * → { results: boolean[], correct, answers?, explanation? }
 *
 * Checks a "Try it yourself" exercise. The right answers and the explanation
 * come back once every blank is right, or when the student asks to see them.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth()
  if (error) return error
  const exercise = await getExercise((await params).id)
  if (!exercise) return NextResponse.json({ error: "Exercise not found" }, { status: 404 })
  if (session?.user?.role !== "ADMIN") {
    const lock = await getTopicLock(session!.user.id, exercise.topicId)
    if (lock) return NextResponse.json(lockedResponseBody(lock), { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as { answers?: unknown; reveal?: unknown }
  const answers = (Array.isArray(body.answers) ? body.answers : []).map(a => String(a ?? "").slice(0, 500))
  const results = checkExercise(exercise, answers)
  const correct = results.length > 0 && results.every(Boolean)
  const show = correct || body.reveal === true
  return NextResponse.json({
    results,
    correct,
    ...(show ? { answers: exercise.blanks.map(b => b.answers[0] ?? ""), explanation: exercise.explanation } : {}),
  })
}
