import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomInt } from "crypto"

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
        const { topicId, questionIds, moduleId, settings } = body

        if (!topicId && !moduleId && !questionIds) {
            return NextResponse.json(
                { error: "Missing required fields: topicId, moduleId, or questionIds" },
                { status: 400 }
            )
        }

        let questions: any = []
        let quizTopicId = topicId
        let quizModuleId = moduleId

        // Get questions based on input
        if (questionIds && questionIds.length > 0) {
            // Specific questions provided
            questions = await prisma.question.findMany({
                where: {
                    id: { in: questionIds },
                },
                include: {
                    answers: true,
                    topic: {
                        include: {
                            chapter: {
                                include: {
                                    module: true,
                                },
                            },
                        },
                    },
                },
            })
        } else if (topicId) {
            // Get questions for a specific topic
            questions = await prisma.question.findMany({
                where: { topicId },
                include: {
                    answers: true,
                    topic: {
                        include: {
                            chapter: {
                                include: {
                                    module: true,
                                },
                            },
                        },
                    },
                },
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
                include: {
                    answers: true,
                    topic: {
                        include: {
                            chapter: {
                                include: {
                                    module: true,
                                },
                            },
                        },
                    },
                },
            })
            quizModuleId = moduleId
        }

        if (questions.length === 0) {
            return NextResponse.json(
                { error: "No questions found for this quiz" },
                { status: 404 }
            )
        }

        // Apply quiz settings
        const quizSettings = {
            randomizeQuestions: settings?.randomizeQuestions ?? true,
            randomizeOptions: settings?.randomizeOptions ?? true,
            questionsPerQuiz: settings?.questionsPerQuiz ?? Math.min(questions.length, 10),
            timeLimit: settings?.timeLimit ?? null,
            passingScore: settings?.passingScore ?? 70,
            allowRetry: settings?.allowRetry ?? true,
        }

        // Select questions (random if enabled)
        let selectedQuestions = [...questions]
        if (quizSettings.randomizeQuestions) {
            selectedQuestions = shuffleArray(selectedQuestions)
        }

        // Limit number of questions
        selectedQuestions = selectedQuestions.slice(0, quizSettings.questionsPerQuiz)

        // Randomize options for each question if enabled
        if (quizSettings.randomizeOptions) {
            selectedQuestions = selectedQuestions.map(q => ({
                ...q,
                answers: shuffleArray(q.answers),
            }))
        }

        // Get user's previous attempts for this topic/module
        let previousAttempts = []
        let unansweredQuestions = []
        let oldestAnsweredQuestions = []

        if (topicId) {
            // Get previous answers for this topic
            const previousAnswers = await prisma.userAnswer.findMany({
                where: {
                    userId: user.id,
                    question: {
                        topicId,
                    },
                },
                select: {
                    questionId: true,
                    answeredAt: true,
                    isCorrect: true,
                },
                orderBy: {
                    answeredAt: 'asc',
                },
            })

            previousAttempts = previousAnswers

            // Identify unanswered questions
            const answeredQuestionIds = new Set(previousAnswers.map(a => a.questionId))
            unansweredQuestions = selectedQuestions.filter(q => !answeredQuestionIds.has(q.id))

            // Get oldest answered questions for fallback
            const answeredQuestionsMap = new Map()
            previousAnswers.forEach(answer => {
                if (!answeredQuestionsMap.has(answer.questionId)) {
                    answeredQuestionsMap.set(answer.questionId, answer)
                }
            })

            oldestAnsweredQuestions = Array.from(answeredQuestionsMap.values())
                .sort((a, b) => a.answeredAt.getTime() - b.answeredAt.getTime())
                .map(a => selectedQuestions.find(q => q.id === a.questionId))
                .filter(Boolean)
        }

        // Determine question order based on retry logic
        let finalQuestions = selectedQuestions
        if (unansweredQuestions && unansweredQuestions.length > 0) {
            // Prioritize unanswered questions
            const answered = selectedQuestions.filter(q => !unansweredQuestions.includes(q))
            finalQuestions = [...unansweredQuestions, ...answered]
        } else if (oldestAnsweredQuestions && oldestAnsweredQuestions.length > 0) {
            // Fallback to oldest answered questions
            finalQuestions = [...oldestAnsweredQuestions, ...selectedQuestions.filter(q => !oldestAnsweredQuestions.includes(q))]
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
                    answers: q.answers.map((a: any) => ({
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
        const questionAttempts = await prisma.questionAttempt?.createMany({
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
                    options: q.answers.map((a: any) => ({
                        id: a.id,
                        text: a.answer,
                    })),
                    topic: {
                        id: q.topic.id,
                        title: q.topic.title,
                        chapter: q.topic.chapter.title,
                        module: q.topic.chapter.module.title,
                    },
                })),
                totalQuestions: finalQuestions.length,
                settings: quizSettings,
                startedAt: quizAttempt.startedAt,
                expiresAt: quizSettings.timeLimit
                    ? new Date(Date.now() + quizSettings.timeLimit * 60000)
                    : null,
                previousAttempts: {
                    count: previousAttempts.length,
                    hasUnanswered: unansweredQuestions.length > 0,
                    unansweredCount: unansweredQuestions.length,
                },
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

        if (isExpired && quizAttempt.status === "IN_PROGRESS") {
            await prisma.quizAttempt.update({
                where: { id: quizAttempt.id },
                data: { status: "EXPIRED" },
            })
        }

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
        const { attemptId, questionId, selectedAnswerId, isCorrect } = body

        if (!attemptId || !questionId || !selectedAnswerId) {
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

        // Update question attempt
        const questionAttempt = await prisma.questionAttempt.update({
            where: {
                quizAttemptId_questionId: {
                    quizAttemptId: attemptId,
                    questionId: questionId,
                },
            },
            data: {
                selectedAnswerId,
                isCorrect: isCorrect || false,
                status: "ANSWERED",
                answeredAt: new Date(),
            },
        })

        // Check if all questions are answered
        const allQuestionAttempts = await prisma.questionAttempt.findMany({
            where: {
                quizAttemptId: attemptId,
            },
        })

        const allAnswered = allQuestionAttempts.every(qa => qa.status === "ANSWERED")

        if (allAnswered) {
            // Calculate final score
            const correctCount = allQuestionAttempts.filter(qa => qa.isCorrect).length
            const score = Math.round((correctCount / quizAttempt.totalQuestions) * 100)

            // Update quiz attempt
            await prisma.quizAttempt.update({
                where: { id: attemptId },
                data: {
                    status: "COMPLETED",
                    completedAt: new Date(),
                    score,
                },
            })

            // Save user answers to permanent storage
            for (const qa of allQuestionAttempts) {
                if (qa.selectedAnswerId) {
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
            }

            return NextResponse.json({
                success: true,
                completed: true,
                score,
                totalQuestions: quizAttempt.totalQuestions,
                correctCount,
                passingScore: JSON.parse(quizAttempt.settings).passingScore,
                passed: score >= JSON.parse(quizAttempt.settings).passingScore,
                message: `Quiz completed! You scored ${score}%`,
            })
        }

        return NextResponse.json({
            success: true,
            completed: false,
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