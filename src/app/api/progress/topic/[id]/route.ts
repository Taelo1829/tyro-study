import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; }>; }
) {
  try {
    const { error, userId } = await requireAuth()
    if (error) return error

    const { id } = await params

    // Use the finished quiz attempts for this topic. The old version counted
    // *questions answered* as "attempts" and divided every correct answer ever
    // given by the number of questions, so the "best score" could go above 100%.
    const completedAttempts = await prisma.quizAttempt.findMany({
      where: {
        userId: userId!,
        topicId: id,
        status: "COMPLETED",
      },
      select: { score: true, completedAt: true },
      orderBy: { completedAt: "desc" },
    })

    const bestScore = completedAttempts.reduce(
      (best, attempt) => Math.max(best, attempt.score ?? 0),
      0
    )

    return NextResponse.json({
      completed: completedAttempts.length > 0,
      quizAttempts: completedAttempts.length,
      bestScore,
      lastAttemptAt: completedAttempts[0]?.completedAt ?? null,
    })
  } catch (error) {
    console.error("Error fetching progress:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
