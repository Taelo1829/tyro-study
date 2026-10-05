import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import { moduleProgress } from "@/lib/quiz-stats"
import { moduleSteps } from "@/lib/progress-steps"

/** GET → { [moduleId]: { done, total, percent } } for the modules the student has joined */
export async function GET() {
  const { error, session } = await requireAuth()
  if (error) return error
  const userId = session!.user.id
  const joined = await prisma.moduleEnrollment.findMany({ where: { userId }, select: { moduleId: true } })
  const entries = await Promise.all(
    joined.map(async ({ moduleId }) => {
      const p = await moduleProgress(userId, moduleId)
      if (!p) return null
      const s = moduleSteps(p)
      return [moduleId, { done: s.done, total: s.total, percent: s.percent }] as const
    })
  )
  return NextResponse.json(Object.fromEntries(entries.filter((e): e is NonNullable<typeof e> => !!e)))
}
