import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import { moduleProgress } from "@/lib/quiz-stats"

/**
 * GET → the student's quiz tracking for a module: every topic quiz, chapter
 * quiz and the mock exam (attempts, passes, fails, scores, times), chapter
 * quiz time estimates and the mock exam plan. Admins can pass ?userId= to
 * see a student's.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth()
  if (error) return error
  const asked = new URL(request.url).searchParams.get("userId")
  if (asked && asked !== session!.user.id && session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const userId = asked ?? session!.user.id

  const progress = await moduleProgress(userId, (await params).id)
  if (!progress) return NextResponse.json({ error: "Module not found" }, { status: 404 })

  // An unfinished mock exam (it can be continued; the clock keeps running)
  const open = await prisma.quizAttempt.findFirst({
    where: { userId, status: "IN_PROGRESS", settings: { contains: `"source":"module:${progress.moduleId}"` } },
    select: { startedAt: true },
    orderBy: { startedAt: "desc" },
  })
  const student = asked ? await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }) : null

  return NextResponse.json({ ...progress, mockInProgress: open ? { startedAt: open.startedAt } : null, student })
}
