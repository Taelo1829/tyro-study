"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ScratchPad } from "./scratch-pad"
import { MathText } from "@/components/ui/math-text"

/**
 * Shared quiz screen for topic and chapter quizzes.
 *
 * Questions come from POST /api/quiz/attempt (which never includes the correct
 * answers). Each answer is graded and saved by PUT /api/quiz/attempt the moment
 * you press "Submit", so you get right/wrong feedback straight away. When the
 * last question of the quiz is answered the attempt is complete and the
 * results are shown - no further questions are added.
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
    topic: { id: string; title: string; moduleId?: string } | null
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

interface FocusTopic {
    key: string
    title: string
    href: string | null
    wrong: number
    total: number
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
    source: { topicId: string } | { chapterId: string } | { moduleId: string }
    /** Heading; defaults to the first question's topic title */
    title?: string
    backHref: string
    backLabel: string
}

type Phase = "loading" | "error" | "answering" | "results"

export function QuizRunner({ source, title: titleProp, backHref, backLabel }: QuizRunnerProps) {
    const [phase, setPhase] = useState<Phase>("loading")
    const [error, setError] = useState("")
    const [attemptId, setAttemptId] = useState<string | null>(null)
    const [questions, setQuestions] = useState<QuizQuestion[]>([])
    const [index, setIndex] = useState(0)
    const [selected, setSelected] = useState<Record<string, string>>({})
    const [results, setResults] = useState<Record<string, AnswerResult>>({})
    const [checking, setChecking] = useState(false)
    const [final, setFinal] = useState<FinalResult | null>(null)
    // Stopwatch: counts up from when the quiz loaded on this device
    const [startedAt, setStartedAt] = useState<number | null>(null)
    const [now, setNow] = useState(() => Date.now())

    const sourceKey = JSON.stringify(source)
    // Chapter/module quizzes cover several topics, so show which ones to revise
    const showFocusTopics = !("topicId" in source)

    const start = useCallback(async () => {
        setPhase("loading")
        setError("")
        setSelected({})
        setResults({})
        setFinal(null)
        setIndex(0)
        setChecking(false)
        setStartedAt(null)

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

    // Tick the stopwatch once a second until the results are shown
    useEffect(() => {
        if (phase !== "answering" || !startedAt) return
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [phase, startedAt])

    const elapsedMs = startedAt ? Math.max(0, now - startedAt) : null

    function readFinal(data: Record<string, unknown>): FinalResult {
        return {
            score: Number(data.score),
            correctCount: Number(data.correctCount),
            totalQuestions: Number(data.totalQuestions),
            passed: !!data.passed,
            passingScore: Number(data.passingScore),
            durationSeconds: typeof data.durationSeconds === "number"
                ? data.durationSeconds
                : startedAt ? Math.round((Date.now() - startedAt) / 1000) : null,
        }
    }

    async function put(payload: Record<string, unknown>) {
        const res = await fetch("/api/quiz/attempt", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attemptId, ...payload }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? "Could not save your answer.")
        return data as Record<string, unknown>
    }

    /** Grade the current question on the server and show right/wrong */
    async function submitAnswer() {
        const question = questions[index]
        const selectedAnswerId = selected[question.id]
        if (!attemptId || !selectedAnswerId || results[question.id] || checking) return

        setChecking(true)
        setError("")
        try {
            const data = await put({ questionId: question.id, selectedAnswerId })
            setResults(prev => ({
                ...prev,
                [question.id]: {
                    isCorrect: !!data.isCorrect,
                    correctAnswerId: (data.correctAnswerId as string | null) ?? null,
                },
            }))
            // Answering the last question completes the attempt on the server
            if (data.completed) setFinal(readFinal(data))
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save your answer.")
        } finally {
            setChecking(false)
        }
    }

    /** Move on after seeing the feedback; after the last question show results */
    async function goNext() {
        if (index < questions.length - 1) {
            setIndex(i => i + 1)
            return
        }
        if (!final) {
            // Safety net in case the completion response was missed
            try {
                setChecking(true)
                setFinal(readFinal(await put({ finish: true })))
            } catch (err) {
                setError(err instanceof Error ? err.message : "Could not finish the quiz.")
                return
            } finally {
                setChecking(false)
            }
        }
        setPhase("results")
    }

    const title = titleProp ?? questions[0]?.topic?.title ?? "Quiz"

    const backLink = (
        <Link
            href={backHref}
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
            ← {backLabel}
        </Link>
    )

    const primaryButton =
        "rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground shadow-lg shadow-black/30 transition-all hover:opacity-90 active:scale-[0.98]"
    const disabledButton = "neo-inset cursor-not-allowed rounded-full px-6 py-3 font-medium text-muted-foreground"

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
                        className="neo-button mt-4 px-6 py-3 font-medium text-foreground hover:opacity-90"
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
        let messageColor = "text-red-600"
        if (percentage >= 80) {
            message = "Excellent! You've mastered this! 🎉"
            messageColor = "text-green-600"
        } else if (percentage >= 60) {
            message = "Good job! A bit more practice and you'll get it! 📚"
            messageColor = "text-primary"
        } else if (percentage >= 40) {
            message = "Not bad! Review the material and try again! 💪"
            messageColor = "text-amber-600"
        }

        // Topics with wrong answers, worst first
        const byTopic = new Map<string, FocusTopic>()
        for (const question of questions) {
            const key = question.topic?.id ?? "__chapter__"
            const entry = byTopic.get(key) ?? {
                key,
                title: question.topic?.title ?? "General chapter questions",
                href: question.topic?.moduleId
                    ? `/modules/${question.topic.moduleId}/topics/${question.topic.id}`
                    : null,
                wrong: 0,
                total: 0,
            }
            entry.total += 1
            if (!results[question.id]?.isCorrect) entry.wrong += 1
            byTopic.set(key, entry)
        }
        const focusTopics = [...byTopic.values()]
            .filter(t => t.wrong > 0)
            .sort((a, b) => b.wrong / b.total - a.wrong / a.total || b.wrong - a.wrong)

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
                                    className="h-3 rounded-full bg-accent transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>

                            <p className={`mb-8 text-lg font-medium ${messageColor}`}>{message}</p>

                            <div className="flex justify-center gap-4">
                                <button onClick={() => void start()} className={primaryButton}>
                                    Take Quiz Again
                                </button>
                                <Link
                                    href={backHref}
                                    className="neo-button px-6 py-3 font-medium text-foreground transition-all hover:opacity-90"
                                >
                                    {backLabel}
                                </Link>
                            </div>
                        </div>

                        {showFocusTopics && (
                            <div className="mt-12 border-t border-border pt-8">
                                <h2 className="mb-1 text-xl font-bold text-foreground">Topics to focus on</h2>
                                {focusTopics.length === 0 ? (
                                    <p className="text-sm text-green-700">You got everything right, no weak topics this time. 🎉</p>
                                ) : (
                                    <>
                                        <p className="mb-4 text-sm text-muted-foreground">
                                            You missed questions from these topics. Revise them, then try the quiz again.
                                        </p>
                                        <ul className="space-y-2">
                                            {focusTopics.map(topic => {
                                                const row = (
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="font-medium text-foreground">{topic.title}</span>
                                                        <span className="shrink-0 text-sm font-medium text-red-600">
                                                            {topic.wrong} of {topic.total} wrong
                                                        </span>
                                                    </div>
                                                )
                                                return (
                                                    <li key={topic.key}>
                                                        {topic.href ? (
                                                            <Link href={topic.href} className="neo-inset block p-4 transition-colors hover:text-primary">
                                                                {row}
                                                            </Link>
                                                        ) : (
                                                            <div className="neo-inset p-4">{row}</div>
                                                        )}
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    </>
                                )}
                            </div>
                        )}

                        <div className="mt-12 border-t border-border pt-8">
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
                                                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
                                                >
                                                    {isCorrect ? "✓" : "✗"}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="mb-2 whitespace-pre-wrap font-medium text-foreground">
                                                        {idx + 1}. <MathText text={question.text} />
                                                    </p>
                                                    <div className="text-sm text-muted-foreground">
                                                        <p>Your answer: {result && yourAnswer ? <MathText text={yourAnswer.text} /> : "Not answered"}</p>
                                                        {!isCorrect && correctAnswer && (
                                                            <p className="mt-1 font-medium text-green-700">
                                                                Correct answer: <MathText text={correctAnswer.text} />
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

    // ── Answering ───────────────────────────────────────────────────────────
    const current = questions[index]
    const result = results[current.id]
    const answered = !!result
    const hasSelected = !!selected[current.id]
    const isLast = index === questions.length - 1
    const answeredCount = Object.keys(results).length

    return (
        <div className="px-4 pb-28 pt-12">
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
                                className="h-2 rounded-full bg-accent transition-all duration-300"
                                style={{ width: `${(answeredCount / questions.length) * 100}%` }}
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
                        <h2 className="whitespace-pre-wrap text-xl font-semibold text-foreground"><MathText text={current.text} /></h2>
                    </div>

                    <div className="space-y-3">
                        {current.options.map(option => {
                            const isSelected = selected[current.id] === option.id
                            const isRightAnswer = answered && option.id === result.correctAnswerId
                            const isWrongPick = answered && isSelected && !result.isCorrect

                            let style = "border-border bg-card hover:bg-muted"
                            if (isRightAnswer) style = "border-green-500 bg-tint-mint"
                            else if (isWrongPick) style = "border-red-400 bg-red-50"
                            else if (isSelected) style = "border-accent bg-tint-blue"
                            else if (answered) style = "border-border bg-card opacity-60"

                            return (
                                <button
                                    key={option.id}
                                    disabled={answered || checking}
                                    onClick={() => setSelected(prev => ({ ...prev, [current.id]: option.id }))}
                                    className={`w-full rounded-2xl border-2 p-4 text-left transition-all ${style} ${answered ? "cursor-default" : ""}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${isSelected ? "border-primary bg-primary" : "border-muted-foreground"}`}
                                        >
                                            {isSelected && <div className="h-2 w-2 rounded-full bg-[var(--neo-primary-foreground)]" />}
                                        </div>
                                        <span className="min-w-0 flex-1 text-foreground"><MathText text={option.text} /></span>
                                        {isRightAnswer && <span className="shrink-0 text-sm font-semibold text-green-700">✓ Correct answer</span>}
                                        {isWrongPick && <span className="shrink-0 text-sm font-semibold text-red-600">✗ Your answer</span>}
                                    </div>
                                </button>
                            )
                        })}
                    </div>

                    {answered && (
                        <div
                            role="status"
                            className={`mt-6 rounded-2xl border p-4 font-semibold ${result.isCorrect ? "border-green-200 bg-tint-mint text-green-800" : "border-red-200 bg-red-50 text-red-700"}`}
                        >
                            {result.isCorrect ? "✓ Correct! Well done." : "✗ Not quite. The correct answer is highlighted in green."}
                        </div>
                    )}
                </div>

                {error && <p className="mb-4 text-center text-sm text-red-600" role="alert">{error}</p>}

                <div className="flex justify-end gap-4">
                    {!answered ? (
                        <button
                            onClick={() => void submitAnswer()}
                            disabled={!hasSelected || checking}
                            className={hasSelected && !checking ? primaryButton : disabledButton}
                        >
                            {checking ? "Checking…" : "Submit"}
                        </button>
                    ) : (
                        <button
                            onClick={() => void goNext()}
                            disabled={checking}
                            className={checking ? disabledButton : primaryButton}
                        >
                            {isLast ? "See results" : "Next Question"}
                        </button>
                    )}
                </div>

                <div className="mt-6 text-center text-sm text-muted-foreground">
                    {answeredCount} of {questions.length} questions answered
                </div>
            </div>

            {/* Floating scrap paper - keyed to the attempt so a new quiz starts blank */}
            <ScratchPad key={attemptId ?? "pad"} />
        </div>
    )
}
