import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTopicLock, lockedResponseBody } from "@/lib/topic-locks"
import type { Prisma } from "@/prisma/client"

/** Extra time after an (optional) time limit for a late submit to arrive */
const SUBMIT_GRACE_MS = 2 * 60_000

const questionInclude = {
    answers: true,
    topic: { include: { chapter: { include: { module: true } } } },
} as const

type PoolQuestion = Prisma.QuestionGetPayload<{ include: typeof questionInclude }>

// POST - Create a new quiz attempt
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        })

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            )
        }

        const body = await req.json()
        const { topicId, questionIds, moduleId, chapterId, settings } = body

        if (!topicId && !moduleId && !questionIds && !chapterId) {
            return NextResponse.json(
                { error: "Missing required fields: topicId, chapterId, moduleId, or questionIds" },
                { status: 400 }
            )
        }

        // A locked topic's quiz can't be started until the previous topic's quiz is passed
        if (topicId && user.role !== "ADMIN") {
            const lock = await getTopicLock(user.id, topicId)
            if (lock) return NextResponse.json(lockedResponseBody(lock), { status: 403 })
        }

        let questions: PoolQuestion[] = []
        let quizTopicId = topicId
        let quizModuleId = moduleId

        // Get questions based on input
        if (questionIds && questionIds.length > 0) {
            // Specific questions provided
            questions = await prisma.question.findMany({
                where: {
                    id: { in: questionIds },
                },
                include: questionInclude,
            })
        } else if (topicId) {
            // Get questions for a specific topic
            questions = await prisma.question.findMany({
                where: { topicId },
                include: questionInclude,
            })
            quizTopicId = topicId
        } else if (moduleId) {
            // Get questions for an entire module
            questions = await prisma.question.findMany({
                where: {
                    topic: {
                        chapter: {
                            moduleId,
                        },
                    },
                },
                include: questionInclude,
            })
            quizModuleId = moduleId
        } else if (chapterId) {
            // Chapter quiz: questions added to the chapter itself plus every
            // question from the chapter's topics
            questions = await prisma.question.findMany({
                where: {
                    OR: [{ chapterId }, { topic: { chapterId } }],
                },
                include: questionInclude,
            })
        }

        if (questions.length === 0) {
            return NextResponse.json(
                { error: "No questions found for this quiz" },
                { status: 404 }
            )
        }

        // How many questions go into one quiz. Sensible defaults per quiz type,
        // capped by how many questions exist. Callers may pass a number.
        const defaultQuizSize = questionIds?.length
            ? questions.length
            : topicId || chapterId ? 20 : 25
        const requestedSize = Number(settings?.questionsPerQuiz)
        const questionsPerQuiz = Math.min(
            questions.length,
            Number.isFinite(requestedSize) && requestedSize >= 1
                ? Math.floor(requestedSize)
                : defaultQuizSize
        )

        // Apply quiz settings
        const quizSettings = {
            randomizeQuestions: settings?.randomizeQuestions ?? true,
            randomizeOptions: settings?.randomizeOptions ?? true,
            questionsPerQuiz,
            // No time limit by default - the quiz is timed (stopwatch), not limited
            timeLimit: settings?.timeLimit ?? null,
            passingScore: settings?.passingScore ?? 70,
            allowRetry: settings?.allowRetry ?? true,
        }

        // ── Rotate questions ────────────────────────────────────────────────
        // Count how many times this user has answered each question in the pool
        // (in submitted quizzes). Questions answered the fewest times are picked
        // first, so you work through every question before any comes back a
        // second time; then the cycle starts again. Ties are broken randomly.
        const timesAnswered = await prisma.questionAttempt.groupBy({
            by: ["questionId"],
            where: {
                questionId: { in: questions.map(q => q.id) },
                status: "ANSWERED",
                quizAttempt: { userId: user.id },
            },
            _count: { _all: true },
        })
        const answerCount = new Map(timesAnswered.map(t => [t.questionId, t._count._all]))
        const countFor = (questionId: string) => answerCount.get(questionId) ?? 0

        const ranked = shuffleArray(questions)
            .map((q, i) => ({ q, i, count: countFor(q.id) }))
            .sort((x, y) => x.count - y.count || x.i - y.i)

        let finalQuestions = ranked.slice(0, questionsPerQuiz).map(r => r.q)

        // Present the picked questions in random order (not grouped by count)
        if (quizSettings.randomizeQuestions) {
            finalQuestions = shuffleArray(finalQuestions)
        }

        // Randomize options for each question if enabled
        if (quizSettings.randomizeOptions) {
            finalQuestions = finalQuestions.map(q => ({
                ...q,
                answers: shuffleArray(q.answers),
            }))
        }

        // Progress through the current cycle, for the client to show if wanted
        const lowestCount = Math.min(...questions.map(q => countFor(q.id)))
        const rotation = {
            totalInPool: questions.length,
            seenAtLeastOnce: questions.filter(q => countFor(q.id) > 0).length,
            remainingThisRound: questions.filter(q => countFor(q.id) === lowestCount).length,
            round: lowestCount + 1,
        }

        const quizAttempt = await prisma.quizAttempt.create({
            data: {
                userId: user.id,
                topicId: quizTopicId,
                moduleId: quizModuleId,
                totalQuestions: finalQuestions.length,
                questionsData: JSON.stringify(finalQuestions.map(q => ({
                    id: q.id,
                    question: q.question,
                    difficulty: q.difficulty,
                    answers: q.answers.map(a => ({
                        id: a.id,
                        answer: a.answer,
                    })),
                }))),
                settings: JSON.stringify(quizSettings),
                status: "IN_PROGRESS",
                startedAt: new Date(),
            },
        })


        // Create individual question attempts
        await prisma.questionAttempt.createMany({
            data: finalQuestions.map((q, index) => ({
                quizAttemptId: quizAttempt.id,
                questionId: q.id,
                order: index,
                status: "PENDING",
            })),
        })

        return NextResponse.json({
            success: true,
            data: {
                attemptId: quizAttempt.id,
                questions: finalQuestions.map(q => ({
                    id: q.id,
                    text: q.question,
                    difficulty: q.difficulty,
                    options: q.answers.map(a => ({
                        id: a.id,
                        text: a.answer,
                    })),
                    // Chapter-level questions have no topic, so this must be null-safe
                    topic: q.topic
                        ? {
                            id: q.topic.id,
                            title: q.topic.title,
                            chapter: q.topic.chapter.title,
                            module: q.topic.chapter.module.title,
                            moduleId: q.topic.chapter.moduleId,
                        }
                        : null,
                })),
                totalQuestions: finalQuestions.length,
                settings: quizSettings,
                startedAt: quizAttempt.startedAt,
                expiresAt: quizSettings.timeLimit
                    ? new Date(Date.now() + quizSettings.timeLimit * 60000)
                    : null,
                rotation,
            },
        })
    } catch (error) {
        console.error("Error creating quiz attempt:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

// GET - Get quiz attempt details
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        })

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            )
        }

        const { searchParams } = new URL(req.url)
        const attemptId = searchParams.get("attemptId")

        if (!attemptId) {
            return NextResponse.json(
                { error: "Missing attemptId parameter" },
                { status: 400 }
            )
        }

        const quizAttempt = await prisma.quizAttempt.findUnique({
            where: {
                id: attemptId,
                userId: user.id,
            },
            include: {
                questionAttempts: {
                    include: {
                        question: {
                            include: {
                                answers: true,
                            },
                        },
                    },
                    orderBy: {
                        order: 'asc',
                    },
                },
            },
        })

        if (!quizAttempt) {
            return NextResponse.json(
                { error: "Quiz attempt not found" },
                { status: 404 }
            )
        }

        // Check if quiz has expired
        const settings = JSON.parse(quizAttempt.settings)
        const isExpired = settings.timeLimit &&
            quizAttempt.startedAt &&
            Date.now() > new Date(quizAttempt.startedAt).getTime() + (settings.timeLimit * 60000)


        return NextResponse.json({
            success: true,
            data: {
                attemptId: quizAttempt.id,
                status: isExpired ? "EXPIRED" : quizAttempt.status,
                startedAt: quizAttempt.startedAt,
                completedAt: quizAttempt.completedAt,
                totalQuestions: quizAttempt.totalQuestions,
                score: quizAttempt.score,
                passingScore: JSON.parse(quizAttempt.settings).passingScore,
                questions: quizAttempt.questionAttempts.map(qa => ({
                    id: qa.question.id,
                    text: qa.question.question,
                    difficulty: qa.question.difficulty,
                    options: qa.question.answers.map(a => ({
                        id: a.id,
                        text: a.answer,
                    })),
                    userAnswer: qa.selectedAnswerId,
                    isCorrect: qa.isCorrect,
                    status: qa.status,
                    order: qa.order,
                })),
            },
        })
    } catch (error) {
        console.error("Error fetching quiz attempt:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

// PUT - Update quiz attempt (submit answer)
export async function PUT(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        })

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            )
        }

        const body = await req.json()
        // Note: any `isCorrect` sent by the client is ignored - correctness is
        // decided on the server so scores can't be faked from the browser.
        // Send { attemptId, questionId, selectedAnswerId } to answer a question,
        // and/or { attemptId, finish: true } to end the quiz now (e.g. the timer
        // ran out) - unanswered questions then count as wrong.
        const { attemptId, questionId, selectedAnswerId, finish } = body as {
            attemptId?: string
            questionId?: string
            selectedAnswerId?: string
            finish?: boolean
        }

        if (!attemptId || (!finish && (!questionId || !selectedAnswerId))) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            )
        }

        // Verify quiz attempt belongs to user
        const quizAttempt = await prisma.quizAttempt.findFirst({
            where: {
                id: attemptId,
                userId: user.id,
                status: "IN_PROGRESS",
            },
        })

        if (!quizAttempt) {
            return NextResponse.json(
                { error: "Quiz attempt not found or already completed" },
                { status: 404 }
            )
        }

        const settings = JSON.parse(quizAttempt.settings) as {
            passingScore: number
            timeLimit: number | null
        }

        // Answers that arrive after the time limit (plus a short grace period
        // for the auto-submit) are not accepted; the quiz is finished instead.
        const timeIsUp = !!settings.timeLimit &&
            Date.now() > quizAttempt.startedAt.getTime() + settings.timeLimit * 60_000 + SUBMIT_GRACE_MS

        let isCorrect: boolean | null = null
        let correctAnswerId: string | null = null

        if (questionId && selectedAnswerId && !timeIsUp) {
            // The selected answer must belong to this question
            const selectedAnswer = await prisma.answer.findFirst({
                where: { id: selectedAnswerId, questionId },
                select: { isCorrect: true },
            })

            if (!selectedAnswer) {
                return NextResponse.json(
                    { error: "Answer does not belong to this question" },
                    { status: 400 }
                )
            }

            isCorrect = selectedAnswer.isCorrect

            const correctAnswer = await prisma.answer.findFirst({
                where: { questionId, isCorrect: true },
                select: { id: true },
            })
            correctAnswerId = correctAnswer?.id ?? null

            await prisma.questionAttempt.update({
                where: {
                    quizAttemptId_questionId: {
                        quizAttemptId: attemptId,
                        questionId: questionId,
                    },
                },
                data: {
                    selectedAnswerId,
                    isCorrect,
                    status: "ANSWERED",
                    answeredAt: new Date(),
                },
            })
        }

        const allQuestionAttempts = await prisma.questionAttempt.findMany({
            where: { quizAttemptId: attemptId },
        })

        const allAnswered = allQuestionAttempts.every(qa => qa.status === "ANSWERED")

        if (allAnswered || finish || timeIsUp) {
            // Unanswered questions are marked skipped and count as wrong
            await prisma.questionAttempt.updateMany({
                where: { quizAttemptId: attemptId, status: { not: "ANSWERED" } },
                data: { status: "SKIPPED", isCorrect: false },
            })

            const answered = allQuestionAttempts.filter(qa => qa.status === "ANSWERED")
            const correctCount = answered.filter(qa => qa.isCorrect).length
            const score = Math.round((correctCount / quizAttempt.totalQuestions) * 100)

            const completedAt = new Date()
            await prisma.quizAttempt.update({
                where: { id: attemptId },
                data: {
                    status: "COMPLETED",
                    completedAt,
                    score,
                },
            })

            // How long the quiz took, from the server's start/finish times
            const durationSeconds = Math.max(
                0,
                Math.round((completedAt.getTime() - quizAttempt.startedAt.getTime()) / 1000)
            )

            // Save user answers to permanent storage
            for (const qa of answered) {
                if (!qa.selectedAnswerId) continue
                const existingUserAnswer = await prisma.userAnswer.findFirst({
                    where: {
                        userId: user.id,
                        questionId: qa.questionId,
                    },
                })

                if (existingUserAnswer) {
                    await prisma.userAnswer.update({
                        where: { id: existingUserAnswer.id },
                        data: {
                            selectedAnswerId: qa.selectedAnswerId,
                            isCorrect: qa.isCorrect || false,
                            answeredAt: new Date(),
                        },
                    })
                } else {
                    await prisma.userAnswer.create({
                        data: {
                            userId: user.id,
                            questionId: qa.questionId,
                            selectedAnswerId: qa.selectedAnswerId,
                            isCorrect: qa.isCorrect || false,
                        },
                    })
                }
            }

            // Correct answer for every question, for the results review
            const correctAnswers = await prisma.answer.findMany({
                where: {
                    questionId: { in: allQuestionAttempts.map(qa => qa.questionId) },
                    isCorrect: true,
                },
                select: { id: true, questionId: true },
            })

            return NextResponse.json({
                success: true,
                completed: true,
                timedOut: timeIsUp,
                durationSeconds,
                isCorrect,
                correctAnswerId,
                score,
                totalQuestions: quizAttempt.totalQuestions,
                correctCount,
                answeredCount: answered.length,
                passingScore: settings.passingScore,
                passed: score >= settings.passingScore,
                review: allQuestionAttempts.map(qa => ({
                    questionId: qa.questionId,
                    isCorrect: qa.status === "ANSWERED" && !!qa.isCorrect,
                    selectedAnswerId: qa.status === "ANSWERED" ? qa.selectedAnswerId : null,
                    correctAnswerId: correctAnswers.find(a => a.questionId === qa.questionId)?.id ?? null,
                })),
                message: `Quiz completed! You scored ${score}%`,
            })
        }

        return NextResponse.json({
            success: true,
            completed: false,
            isCorrect,
            correctAnswerId,
            message: "Answer saved successfully",
            progress: {
                answered: allQuestionAttempts.filter(qa => qa.status === "ANSWERED").length,
                total: quizAttempt.totalQuestions,
            },
        })
    } catch (error) {
        console.error("Error updating quiz attempt:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

// Helper function to shuffle array
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
            ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
}