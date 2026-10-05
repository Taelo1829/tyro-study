import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-session"
import { getTopicLock, lockedResponseBody } from "@/lib/topic-locks"
import { getTopicCoding } from "@/lib/coding"
import { listExercises, toPublic } from "@/lib/exercises"

type Params = { params: Promise<{ id: string }> }

/**
 * GET → { coding, exercises } - the topic's "Try it yourself" exercises.
 * Students get them without answers (checked by /api/exercises/[id]/check);
 * admins get the answers too.
 */
export async function GET(_request: Request, { params }: Params) {
  const { error, session } = await requireAuth()
  if (error) return error
  const { id } = await params
  const isAdmin = session?.user?.role === "ADMIN"
  if (!isAdmin && session?.user?.id) {
    const lock = await getTopicLock(session.user.id, id)
    if (lock) return NextResponse.json(lockedResponseBody(lock), { status: 403 })
  }
  const coding = await getTopicCoding(id)
  if (!coding) return NextResponse.json({ error: "Topic not found" }, { status: 404 })
  const exercises = coding.language ? await listExercises(id) : []
  return NextResponse.json({
    coding: { language: coding.language },
    exercises: isAdmin ? exercises : exercises.map(toPublic),
  })
}
