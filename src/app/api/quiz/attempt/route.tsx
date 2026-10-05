import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTopicLock, lockedResponseBody } from "@/lib/topic-locks"
import { MOCK_EXAM_PASS_MARK, moduleProgress } from "@/lib/quiz-stats"
import type { Prisma } from "@/prisma/client"

/** Extra time after an (optional) time limit for a late submit to arrive */
const SUBMIT_GRACE_MS = 2 * 60_000

const questionInclude = {
    answers: true,
    topic: { include: { chapter: { include: { module: true } } } },
} as const

type PoolQuestion = Prisma.QuestionGetPayload<{ include: typeof questionInclude }>

/** Which questions came from a past paper (question id → paper name) */
async function paperNames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map()
    const rows = await prisma.$queryRaw<{ id: string; paper: string }[]>`
        SELECT "id", "paper" FROM "questions" WHERE "paper" IS NOT NULL AND "id" = ANY(${ids}::text[])`
    return new Map(rows.map(r => [r.id, r.paper]))
}

/** An unfinished quiz is picked up again (after a refresh) for this long */
const RESUME_WINDOW_MS = 24 * 60 * 60_000

/** Which quiz this is, saved in the attempt's settings so it can be resumed */
function sourceKeyOf(body: { topicId?: string; chapterId?: string; moduleId?: string }) {
    if (body.topicId) return `topic:${body.topicId}`
    if (body.chapterId) return `chapter:${body.chapterId}`
    if (body.moduleId) return `module:${body.moduleId}`
    return null
}

function questionTopic(q: PoolQuestion) {
    // Chapter-level questions have no topic, so this must be null-safe
    return q.topic
        ? {
            id: q.topic.id,
            title: q.topic.title,
            chapter: q.topic.chapter.title,
            module: q.topic.chapter.module.title,
            moduleId: q.topic.chapter.moduleId,
        }
        : null
}

/**
 * The user's unfinished attempt at this quiz, in the same shape as a new one
 * plus the answers given so far, or null. Same questions, same option order
 * (as saved when it started), and the original start time so the stopwatch
 * carries on. Older unfinished attempts are closed as abandoned.
 */
async function resumeAttempt(userId: string, source: string) {
    const open = await prisma.quizAttempt.findMany({
        where: { userId, status: "IN_PROGRESS", settings: { contains: `"source":"${source}"` } },
        orderBy: { startedAt: "desc" },
        include: { questionAttempts: { orderBy: { order: "asc" } } },
    })
    const fresh = open.find(a => Date.now() - a.startedAt.getTime() < RESUME_WINDOW_MS)
    const stale = open.filter(a => a !== fresh).map(a => a.id)
    if (stale.length) {
        await prisma.quizAttempt.updateMany({ where: { id: { in: stale } }, data: { status: "ABANDONED" } })
    }
    if (!fresh) return null

    const saved = JSON.parse(fresh.questionsData) as { id: string; question: string; difficulty: string; answers: { id: string; answer: string }[] }[]
    const pool = await prisma.question.findMany({ where: { id: { in: saved.map(q => q.id) } }, include: questionInclude })
    const byId = new Map(pool.map(q => [q.id, q]))
    // A question deleted since the quiz started can't be shown again: start over instead
    if (saved.some(q => !byId.has(q.id))) {
        await prisma.quizAttempt.update({ where: { id: fresh.id }, data: { status: "ABANDONED" } })
        return null
    }

    const answered = fresh.questionAttempts
        .filter(qa => qa.status === "ANSWERED" && qa.selectedAnswerId)
        .map(qa => ({
            questionId: qa.questionId,
            selectedAnswerId: qa.selectedAnswerId!,
            isCorrect: !!qa.isCorrect,
            correctAnswerId: byId.get(qa.questionId)!.answers.find(a => a.isCorrect)?.id ?? null,
        }))
    const settings = JSON.parse(fresh.settings)
    const papers = await paperNames(saved.map(q => q.id))

    return {
        attemptId: fresh.id,
        resumed: true,
        questions: saved.map(q => ({
            id: q.id,
            text: q.question,
            difficulty: q.difficulty,
            options: q.answers.map(a => ({ id: a.id, text: a.answer })),
            topic: questionTopic(byId.get(q.id)!),
            paper: papers.get(q.id) ?? null,
        })),
        answered,
        totalQuestions: fresh.totalQuestions,
        settings,
        startedAt: fresh.startedAt,
        serverNow: new Date(),
        expiresAt: settings.timeLimit ? new Date(fresh.startedAt.getTime() + settings.timeLimit * 60000) : null,
    }
}

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

        // Refreshed or came back: carry on with the unfinished attempt at this quiz
        const source = questionIds?.length ? null : sourceKeyOf({ topicId, chapterId, moduleId })
        if (source && body.fresh !== true) {
            const resumed = await resumeAttempt(user.id, source)
            if (resumed) return NextResponse.json({ success: true, data: resumed })
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
            // Mock exam: every question in the module (topics' and chapters' own)
            questions = await prisma.question.findMany({
                where: {
                    OR: [{ topic: { chapter: { moduleId } } }, { chapter: { moduleId } }],
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

        // Mock exam: questions shared out by chapter, timed from the student's
        // chapter quiz times (at most 3 hours). Chapter quiz: an estimated time.
        const progress = moduleId || chapterId
            ? await moduleProgress(user.id, moduleId ?? (await prisma.chapter.findUnique({ where: { id: chapterId }, select: { moduleId: true } }))?.moduleId ?? "")
            : null
        const mockPlan = moduleId && !questionIds?.length ? progress?.mock.plan ?? null : null
        const chapterEstimateSeconds = chapterId ? progress?.chapters.find(c => c.id === chapterId)?.estimateSeconds ?? null : null

        // Apply quiz settings
        const quizSettings = {
            randomizeQuestions: settings?.randomizeQuestions ?? true,
            randomizeOptions: settings?.randomizeOptions ?? true,
            questionsPerQuiz,
            // No time limit by default - the quiz is timed (stopwatch), not limited
            timeLimit: mockPlan ? mockPlan.timeLimitSeconds / 60 : settings?.timeLimit ?? null,
            passingScore: mockPlan ? MOCK_EXAM_PASS_MARK : settings?.passingScore ?? 70,
            // Shown before and during a chapter quiz (not enforced)
            estimatedSeconds: chapterEstimateSeconds,
            mockExam: !!mockPlan,
            allowRetry: settings?.allowRetry ?? true,
            // Lets a refresh find this attempt again
            source,
        }

        // ── Pick questions at random ────────────────────────────────────────
        // Every quiz draws a fresh random set from the whole pool, in random
        // order. (No rotation: a question can come up again in the next quiz.)
        let finalQuestions = shuffleArray(questions).slice(0, questionsPerQuiz)
        if (mockPlan) {
            // Past-paper questions this student hasn't answered in a mock exam yet come first
            const poolIds = questions.map(q => q.id)
            const paperRows = await prisma.$queryRaw<{ id: string }[]>`
                SELECT "id" FROM "questions" WHERE "paper" IS NOT NULL AND "id" = ANY(${poolIds}::text[])`
            const seenRows = paperRows.length
                ? await prisma.$queryRaw<{ questionId: string }[]>`
                    SELECT DISTINCT qa."questionId" FROM "question_attempts" qa
                    JOIN "quiz_attempts" a ON a."id" = qa."quizAttemptId"
                    WHERE a."userId" = ${user.id} AND qa."status" = 'ANSWERED'
                      AND a."settings" LIKE ${`%"source":"module:${moduleId}"%`}`
                : []
            const seen = new Set(seenRows.map(r => r.questionId))
            const firstChoice = new Set(paperRows.map(r => r.id).filter(id => !seen.has(id)))

            // Each chapter's share: unseen past-paper questions first, then the rest, each at random
            const chapterOf = (q: PoolQuestion) => q.topic?.chapter.id ?? q.chapterId
            finalQuestions = shuffleArray(
                mockPlan.perChapter.flatMap(part => {
                    const inChapter = shuffleArray(questions.filter(q => chapterOf(q) === part.chapterId))
                    return [...inChapter.filter(q => firstChoice.has(q.id)), ...inChapter.filter(q => !firstChoice.has(q.id))].slice(0, part.questions)
                })
            )
        }
        quizSettings.questionsPerQuiz = finalQuestions.length

        // Randomize options for each question if enabled
        if (quizSettings.randomizeOptions) {
            finalQuestions = finalQuestions.map(q => ({
                ...q,
                answers: shuffleArray(q.answers),
            }))
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

        const papers = await paperNames(finalQuestions.map(q => q.id))
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
                    topic: questionTopic(q),
                    paper: papers.get(q.id) ?? null,
                })),
                totalQuestions: finalQuestions.length,
                settings: quizSettings,
                startedAt: quizAttempt.startedAt,
                serverNow: new Date(),
                answered: [],
                expiresAt: quizSettings.timeLimit
                    ? new Date(Date.now() + quizSettings.timeLimit * 60000)
                    : null,
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
            // (a timed exam handed in late, e.g. after leaving the page, counts as its full time)
            const durationSeconds = Math.min(
                Math.max(0, Math.round((completedAt.getTime() - quizAttempt.startedAt.getTime()) / 1000)),
                settings.timeLimit ? Math.round(settings.timeLimit * 60) : Infinity
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