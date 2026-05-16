import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get quiz attempts for this topic
    const attempts = await prisma.userAnswer.groupBy({
      by: ['questionId'],
      where: {
        userId: user.id,
        question: {
          topicId: params.id,
        },
      },
      _count: true,
    })

    const completed = attempts.length > 0

    // Calculate best score
    const questions = await prisma.question.findMany({
      where: { topicId: params.id },
      select: { id: true },
    })

    const correctAnswers = await prisma.userAnswer.count({
      where: {
        userId: user.id,
        isCorrect: true,
        question: {
          topicId: params.id,
        },
      },
    })

    const bestScore = questions.length > 0 
      ? Math.round((correctAnswers / questions.length) * 100)
      : 0

    return NextResponse.json({
      completed,
      quizAttempts: attempts.length,
      bestScore,
      lastAttemptAt: null,
    })
  } catch (error) {
    console.error("Error fetching progress:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}