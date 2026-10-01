"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Shared quiz screen for topic and chapter quizzes.
 *
 * Questions come from POST /api/quiz/attempt (which never includes the correct
 * answers) and every answer is graded and saved by PUT /api/quiz/attempt.
 * The old quiz pages graded in the browser and saved nothing, so progress and
 * best scores never updated — and the correct answers had to be sent to the
 * browser, where anyone could read them.
 */

interface QuizOption {
    id: string
    text: string
}

interface QuizQuestion {
    id: string
    text: string
    difficulty: string
    options: QuizOption[]
    topic: { title: string } | null
}

interface AnswerResult {
    isCorrect: boolean
    correctAnswerId: string | null
}

interface FinalResult {
    score: number
    correctCount: number
    totalQuestions: number
    passed: boolean
    passingScore: number
    durationSeconds: number | null
}

function formatClock(ms: number) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = (totalSeconds % 60).toString().padStart(2, "0")
    return hours > 0
        ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds}`
        : `${minutes}:${seconds}`
}

interface QuizRunnerProps {
    /** Body for POST /api/quiz/attempt, e.g. { topicId } or { chapterId } */
    source: { topicId: string } | { chapterId: string }
    /** Heading; defaults to the first question's topic title */
    title?: string
    backHref: string
    backLabel: string
}

type Phase = "loading" | "error" | "answering" | "submitting" | "results"

export function QuizRunner({ source, title: titleProp, backHref, backLabel }: QuizRunnerProps) {
    const [phase, setPhase] = useState<Phase>("loading")
    const [error, setError] = useState("")
    const [attemptId, setAttemptId] = useState<string | null>(null)
    const [questions, setQuestions] = useState<QuizQuestion[]>([])
    const [index, setIndex] = useState(0)
    const [selected, setSelected] = useState<Record<string, string>>({})
    const [results, setResults] = useState<Record<string, AnswerResult>>({})
    const [final, setFinal] = useState<FinalResult | null>(null)
    // Stopwatch: counts up from when the quiz loaded on this device
    const [startedAt, setStartedAt] = useState<number | null>(null)
    const [now, setNow] = useState(() => Date.now())
    const submittingRef = useRef(false)

    const sourceKey = JSON.stringify(source)

    const start = useCallback(async () => {
        setPhase("loading")
        setError("")
        setSelected({})
        setResults({})
        setFinal(null)
        setIndex(0)
        setStartedAt(null)
        submittingRef.current = false

        try {
            const res = await fetch("/api/quiz/attempt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // The server picks how many questions and which ones (least-seen first)
                body: sourceKey,
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(
                    res.status === 404
                        ? "No questions have been added here yet."
                        : data.error ?? "Could not start the quiz."
                )
            }
            setAttemptId(data.data.attemptId)
            setQuestions(data.data.questions)
            setStartedAt(Date.now())
            setNow(Date.now())
            setPhase("answering")
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not start the quiz.")
            setPhase("error")
        }
    }, [sourceKey])

    useEffect(() => {
        // Fetching on mount is the intended external sync here
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void start()
    }, [start])

    async function submit() {
        if (!attemptId || submittingRef.current) return
        submittingRef.current = true
        setPhase("submitting")
        setError("")

        try {
            let completion: Record<string, unknown> | null = null

            const put = async (payload: Record<string, unknown>) => {
                const res = await fetch("/api/quiz/attempt", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ attemptId, ...payload }),
                })
                const data = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(data.error ?? "Could not submit your answers.")
                if (data.completed) completion = data
                return data
            }

            // Save the answered questions one at a time; answering the last
            // question completes the attempt on the server.
            for (const question of questions) {
                if (completion) break
                const selectedAnswerId = selected[question.id]
                if (!selectedAnswerId) continue
                await put({ questionId: question.id, selectedAnswerId })
            }

            // Safety net: make sure the attempt is marked finished
            if (!completion) await put({ finish: true })

            const done = completion as unknown as {
                score: number
                correctCount: number
                totalQuestions: number
                passed: boolean
                passingScore: number
                durationSeconds?: number
                review?: { questionId: string; isCorrect: boolean; correctAnswerId: string | null }[]
            } | null
            if (!done) throw new Error("Could not finish the quiz.")

            const answerResults: Record<string, AnswerResult> = {}
            for (const item of done.review ?? []) {
                answerResults[item.questionId] = {
                    isCorrect: item.isCorrect,
                    correctAnswerId: item.correctAnswerId,
                }
            }

            setResults(answerResults)
            setFinal({
                score: done.score,
                correctCount: done.correctCount,
                totalQuestions: done.totalQuestions,
                passed: done.passed,
                passingScore: done.passingScore,
                durationSeconds: typeof done.durationSeconds === "number"
                    ? done.durationSeconds
                    : startedAt ? Math.round((Date.now() - startedAt) / 1000) : null,
            })
            setPhase("results")
        } catch (err) {
            submittingRef.current = false
            setError(err instanceof Error ? err.message : "Could not submit your answers.")
            setPhase("answering")
        }
    }

    // Tick the stopwatch once a second while the quiz is being answered
    useEffect(() => {
        if (phase !== "answering" || !startedAt) return
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [phase, startedAt])

    const elapsedMs = startedAt ? Math.max(0, now - startedAt) : null

    const title = titleProp ?? questions[0]?.topic?.title ?? "Quiz"

    const backLink = (
        <Link
            href={backHref}
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
            ← {backLabel}
        </Link>
    )

    if (phase === "loading") {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <div className="text-center">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
                    <p className="mt-4 text-muted-foreground">Loading quiz...</p>
                </div>
            </div>
        )
    }

    if (phase === "error") {
        return (
            <div className="mx-auto max-w-3xl px-4 py-12">
                {backLink}
                <div className="neo-flat p-8 text-center">
                    <p className="text-muted-foreground">{error}</p>
                    <button
                        onClick={() => void start()}
                        className="neo-button mt-4 rounded-xl px-6 py-3 font-medium text-foreground hover:opacity-90"
                    >
                        Try again
                    </button>
                </div>
            </div>
        )
    }

    if (phase === "results") {
        const total = final?.totalQuestions ?? questions.length
        const correct = final?.correctCount ?? Object.values(results).filter(r => r.isCorrect).length
        const percentage = final?.score ?? Math.round((correct / Math.max(total, 1)) * 100)

        let message = "Keep studying! Review the material and take the quiz again! 📖"
        let messageColor = "text-red-400"
        if (percentage >= 80) {
            message = "Excellent! You've mastered this! 🎉"
            messageColor = "text-accent"
        } else if (percentage >= 60) {
            message = "Good job! A bit more practice and you'll get it! 📚"
            messageColor = "text-primary"
        } else if (percentage >= 40) {
            message = "Not bad! Review the material and try again! 💪"
            messageColor = "text-yellow-400"
        }

        return (
            <div className="px-4 py-12">
                <div className="mx-auto max-w-3xl">
                    <div className="neo-flat p-8">
                        <div className="text-center">
                            <div className="neo-pressed mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full">
                                <span className="text-4xl">📊</span>
                            </div>
                            <h1 className="mb-2 text-3xl font-bold text-foreground">Quiz Results</h1>
                            {final?.durationSeconds != null && (
                                <p className="mb-2 text-sm text-muted-foreground">
                                    ⏱ Time taken: <span className="font-mono font-semibold tabular-nums text-foreground">{formatClock(final.durationSeconds * 1000)}</span>
                                </p>
                            )}
                            <p className="mb-6 text-muted-foreground">{title}</p>

                            <div className="mb-2 text-6xl font-bold text-primary">
                                {correct}/{total}
                            </div>
                            <p className="mb-4 text-sm text-muted-foreground">
                                {percentage}%{final ? ` · ${final.passed ? "Passed" : `Pass mark ${final.passingScore}%`}` : ""}
                            </p>

                            <div className="neo-inset mb-6 h-3 w-full rounded-full">
                                <div
                                    className="h-3 rounded-full bg-primary transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>

                            <p className={`mb-8 text-lg font-medium ${messageColor}`}>{message}</p>

                            <div className="flex justify-center gap-4">
                                <button
                                    onClick={() => void start()}
                                    className="neo-button rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground transition-all hover:opacity-90"
                                >
                                    Take Quiz Again
                                </button>
                                <Link
                                    href={backHref}
                                    className="neo-button rounded-xl px-6 py-3 font-medium text-foreground transition-all hover:opacity-90"
                                >
                                    {backLabel}
                                </Link>
                            </div>
                        </div>

                        <div className="mt-12 border-t border-[var(--neo-shadow-light)] pt-8">
                            <h2 className="mb-4 text-xl font-bold text-foreground">Detailed Review</h2>
                            <div className="space-y-4">
                                {questions.map((question, idx) => {
                                    const result = results[question.id]
                                    const yourAnswer = question.options.find(o => o.id === selected[question.id])
                                    const correctAnswer = question.options.find(o => o.id === result?.correctAnswerId)
                                    const isCorrect = !!result?.isCorrect

                                    return (
                                        <div key={question.id} className="neo-inset p-4">
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${isCorrect ? "bg-green-900/40 text-accent" : "bg-red-900/40 text-red-400"}`}
                                                >
                                                    {isCorrect ? "✓" : "✗"}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="mb-2 font-medium text-foreground">
                                                        {idx + 1}. {question.text}
                                                    </p>
                                                    <div className="text-sm text-muted-foreground">
                                                        <p>Your answer: {yourAnswer?.text ?? "Not answered"}</p>
                                                        {!isCorrect && correctAnswer && (
                                                            <p className="mt-1 text-accent">
                                                                Correct answer: {correctAnswer.text}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // answering / submitting
    const current = questions[index]
    const hasSelected = !!selected[current.id]
    const isLast = index === questions.length - 1
    const allAnswered = questions.every(q => selected[q.id])
    const submitting = phase === "submitting"

    return (
        <div className="px-4 py-12">
            <div className="mx-auto max-w-4xl">
                <div className="mb-8">
                    {backLink}
                    <div className="neo-flat p-6">
                        <div className="mb-4 flex items-center justify-between gap-4">
                            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
                            <div className="flex shrink-0 items-center gap-3">
                                <span className="text-sm text-muted-foreground">
                                    Question {index + 1} of {questions.length}
                                </span>
                                {elapsedMs !== null && (
                                    <span
                                        role="timer"
                                        aria-label="Time taken so far"
                                        className="neo-pressed rounded-full px-3 py-1 font-mono text-sm font-semibold tabular-nums text-foreground"
                                    >
                                        ⏱ {formatClock(elapsedMs)}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="neo-inset h-2 w-full overflow-hidden rounded-full">
                            <div
                                className="h-2 rounded-full bg-primary transition-all duration-300"
                                style={{ width: `${((index + 1) / questions.length) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>

                <div className="neo-flat mb-6 p-8">
                    <div className="mb-6">
                        <div className="mb-4 flex flex-wrap gap-2">
                            <span className="neo-pressed inline-block rounded-full px-3 py-1 text-xs font-medium text-muted-foreground">
                                {current.difficulty.toUpperCase()}
                            </span>
                            {current.topic && (
                                <span className="neo-pressed inline-block rounded-full px-3 py-1 text-xs font-medium text-muted-foreground">
                                    {current.topic.title}
                                </span>
                            )}
                        </div>
                        <h2 className="text-xl font-semibold text-foreground">{current.text}</h2>
                    </div>

                    <div className="space-y-3">
                        {current.options.map(option => {
                            const isSelected = selected[current.id] === option.id
                            return (
                                <button
                                    key={option.id}
                                    disabled={submitting}
                                    onClick={() => setSelected(prev => ({ ...prev, [current.id]: option.id }))}
                                    className={`w-full rounded-xl border-2 p-4 text-left transition-all ${isSelected
                                        ? "border-primary bg-primary/10"
                                        : "border-[var(--neo-shadow-light)] hover:bg-[var(--neo-shadow-light)]/30"
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${isSelected ? "border-primary bg-primary" : "border-muted-foreground"}`}
                                        >
                                            {isSelected && <div className="h-2 w-2 rounded-full bg-[var(--neo-primary-foreground)]" />}
                                        </div>
                                        <span className="flex-1 text-foreground">{option.text}</span>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {error && <p className="mb-4 text-center text-sm text-red-400" role="alert">{error}</p>}

                <div className="flex justify-between gap-4">
                    <button
                        onClick={() => setIndex(i => i - 1)}
                        disabled={index === 0 || submitting}
                        className={`rounded-xl px-6 py-3 font-medium transition-all ${index === 0
                            ? "neo-inset cursor-not-allowed text-muted-foreground"
                            : "neo-button text-foreground hover:opacity-90"
                            }`}
                    >
                        Previous
                    </button>

                    {!isLast ? (
                        <button
                            onClick={() => setIndex(i => i + 1)}
                            disabled={!hasSelected}
                            className={`rounded-xl px-6 py-3 font-medium transition-all ${hasSelected
                                ? "neo-button bg-primary text-primary-foreground hover:opacity-90"
                                : "neo-inset cursor-not-allowed text-muted-foreground"
                                }`}
                        >
                            Next Question
                        </button>
                    ) : (
                        <button
                            onClick={() => void submit()}
                            disabled={!allAnswered || submitting}
                            className={`rounded-xl px-8 py-3 font-medium transition-all ${allAnswered && !submitting
                                ? "neo-button bg-primary text-primary-foreground hover:opacity-90"
                                : "neo-inset cursor-not-allowed text-muted-foreground"
                                }`}
                        >
                            {submitting ? "Submitting…" : "Submit Quiz"}
                        </button>
                    )}
                </div>

                <div className="mt-6 text-center text-sm text-muted-foreground">
                    {Object.keys(selected).length} of {questions.length} questions answered
                </div>
            </div>
        </div>
    )
}
