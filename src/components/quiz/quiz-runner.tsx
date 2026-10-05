"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ScratchPad } from "./scratch-pad"
import { MathText } from "@/components/ui/math-text"
import { TopicContentView } from "@/components/topic/topic-content-view"
import { CodeWithBlanks } from "@/components/exercises/code-with-blanks"
import { BLANK } from "@/lib/code-blanks"

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
    /** "blank": type the answer into the blank (____) instead of picking an option */
    kind?: "mcq" | "blank"
    options: QuizOption[]
    topic: { id: string; title: string; moduleId?: string } | null
    /** The past exam/assignment paper it comes from */
    paper?: string | null
}

interface AnswerResult {
    isCorrect: boolean
    correctAnswerId: string | null
    /** Type-the-answer questions: the expected answer */
    correctAnswerText?: string | null
}

/**
 * A type-the-answer question split into what's asked (the paragraphs before
 * the one with the blank) and the code with the blank.
 */
function splitBlankQuestion(text: string): { prompt: string; code: string } {
    const paragraphs = text.split(/\n\s*\n/)
    const at = paragraphs.findIndex(p => new RegExp(BLANK.source).test(p))
    if (at <= 0) return { prompt: "", code: text }
    return { prompt: paragraphs.slice(0, at).join("\n\n"), code: paragraphs.slice(at).join("\n\n") }
}

interface FinalResult {
    score: number
    correctCount: number
    totalQuestions: number
    passed: boolean
    passingScore: number
    durationSeconds: number | null
}

interface MissedNote {
    questionId: string
    question: string
    html: string
}

interface NextStep {
    next: { id: string; title: string; chapterTitle: string; href: string; locked: boolean } | null
    moduleHref: string
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
    // After a pass: the topic to study next (topic and chapter quizzes)
    const [nextStep, setNextStep] = useState<NextStep | null>(null)
    // Study notes for the questions this student got wrong
    const [notes, setNotes] = useState<{ status: "idle" | "loading" | "done" | "error"; items: MissedNote[] }>({ status: "idle", items: [] })
    // Stopwatch: counts up from when the attempt started (on the server, so a refresh keeps the time)
    const [startedAt, setStartedAt] = useState<number | null>(null)
    const [now, setNow] = useState(() => Date.now())
    // Mock exam: a real time limit (counts down, then submits itself)
    const [limitMs, setLimitMs] = useState<number | null>(null)
    // Chapter quiz: roughly how long it should take (not enforced)
    const [estimateMs, setEstimateMs] = useState<number | null>(null)
    const [timedOut, setTimedOut] = useState(false)

    const sourceKey = JSON.stringify(source)
    // Chapter/module quizzes cover several topics, so show which ones to revise
    const showFocusTopics = !("topicId" in source)

    const start = useCallback(async () => {
        setPhase("loading")
        setError("")
        setSelected({})
        setResults({})
        setFinal(null)
        setNextStep(null)
        setNotes({ status: "idle", items: [] })
        setIndex(0)
        setChecking(false)
        setStartedAt(null)
        setLimitMs(null)
        setEstimateMs(null)
        setTimedOut(false)

        try {
            const res = await fetch("/api/quiz/attempt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // The server picks the questions at random, or hands back the
                // unfinished attempt at this quiz (after a refresh) to carry on with
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
            const attempt = data.data as {
                attemptId: string
                questions: QuizQuestion[]
                answered?: {
                    questionId: string
                    selectedAnswerId: string | null
                    typedAnswer?: string | null
                    isCorrect: boolean
                    correctAnswerId: string | null
                    correctAnswerText?: string | null
                }[]
                startedAt: string
                serverNow?: string
                settings?: { timeLimit?: number | null; estimatedSeconds?: number | null }
            }
            setAttemptId(attempt.attemptId)
            setQuestions(attempt.questions)

            // Answers already given (a resumed attempt): show them as answered
            const answered = attempt.answered ?? []
            // (for a type-the-answer question, `selected` holds what was typed)
            setSelected(Object.fromEntries(answered.map(a => [a.questionId, a.typedAnswer ?? a.selectedAnswerId ?? ""])))
            setResults(Object.fromEntries(answered.map(a => [
                a.questionId,
                { isCorrect: a.isCorrect, correctAnswerId: a.correctAnswerId, correctAnswerText: a.correctAnswerText ?? null },
            ])))
            const done = new Set(answered.map(a => a.questionId))
            const firstOpen = attempt.questions.findIndex(q => !done.has(q.id))
            setIndex(firstOpen === -1 ? Math.max(0, attempt.questions.length - 1) : firstOpen)

            // Time so far, measured on the server's clock (this device's clock may differ)
            const elapsed = attempt.serverNow
                ? Math.max(0, new Date(attempt.serverNow).getTime() - new Date(attempt.startedAt).getTime())
                : 0
            setStartedAt(Date.now() - elapsed)
            setNow(Date.now())
            const limit = Number(attempt.settings?.timeLimit)
            setLimitMs(limit > 0 ? limit * 60_000 : null)
            const estimate = Number(attempt.settings?.estimatedSeconds)
            setEstimateMs(estimate > 0 ? estimate * 1000 : null)
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

    // Passed: look up the next topic so the results can offer it
    const nextQuery = "topicId" in source ? `topicId=${source.topicId}` : "chapterId" in source ? `chapterId=${source.chapterId}` : null
    useEffect(() => {
        if (!final?.passed || !nextQuery) return
        let live = true
        fetch(`/api/quiz/next?${nextQuery}`)
            .then(res => (res.ok ? res.json() : null))
            .then((data: NextStep | null) => live && data && setNextStep(data))
            .catch(() => {})
        return () => {
            live = false
        }
    }, [final?.passed, nextQuery])

    // Finished with mistakes: fetch (or have the AI write, once ever per question) notes on them
    const missedCount = final ? final.totalQuestions - final.correctCount : 0
    useEffect(() => {
        if (!final || missedCount <= 0 || !attemptId) return
        let live = true
        // The first student to miss a question waits while its note is written
        queueMicrotask(() => live && setNotes({ status: "loading", items: [] }))
        fetch("/api/quiz/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attemptId }),
        })
            .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
            .then((data: { notes?: MissedNote[] }) => live && setNotes({ status: "done", items: data.notes ?? [] }))
            .catch(() => live && setNotes({ status: "error", items: [] }))
        return () => {
            live = false
        }
    }, [final, missedCount, attemptId])

    const elapsedMs = startedAt ? Math.max(0, now - startedAt) : null
    const leftMs = limitMs !== null && elapsedMs !== null ? Math.max(0, limitMs - elapsedMs) : null

    // Time's up: hand the exam in (unanswered questions count as wrong)
    const outOfTime = phase === "answering" && leftMs === 0
    useEffect(() => {
        if (!outOfTime || !attemptId) return
        let live = true
        fetch("/api/quiz/attempt", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attemptId, finish: true }),
        })
            .then(res => res.json())
            .then(data => {
                if (!live) return
                setTimedOut(true)
                if (data && typeof data.score === "number") setFinal(readFinal(data))
                setPhase("results")
            })
            .catch(() => {})
        return () => {
            live = false
        }
        // readFinal is a plain helper; this runs once when the time runs out
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [outOfTime, attemptId])

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
        const choice = selected[question.id]
        const typed = question.kind === "blank"
        if (!attemptId || !choice?.trim() || results[question.id] || checking) return

        setChecking(true)
        setError("")
        try {
            const data = await put(typed ? { questionId: question.id, typedAnswer: choice } : { questionId: question.id, selectedAnswerId: choice })
            setResults(prev => ({
                ...prev,
                [question.id]: {
                    isCorrect: !!data.isCorrect,
                    correctAnswerId: (data.correctAnswerId as string | null) ?? null,
                    correctAnswerText: (data.correctAnswerText as string | null) ?? null,
                },
            }))
            // Answering the last question completes the attempt on the server
            if (data.timedOut) setTimedOut(true)
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

    // Stays pinned just under the fixed top bar while scrolling through the quiz
    const backLink = (
        <div className="sticky top-[4.5rem] z-40 -mx-4 mb-3 bg-background/95 px-4 py-2 backdrop-blur sm:top-[5.25rem] sm:mx-0 sm:px-0">
            <Link
                href={backHref}
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
                ← {backLabel}
            </Link>
        </div>
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
                            {timedOut && (
                                <p className="mb-2 text-sm font-medium text-orange-700">
                                    Time ran out, so the exam was handed in. Questions you hadn&apos;t answered count as wrong.
                                </p>
                            )}
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

                            {final?.passed && nextStep && (
                                <div className="mb-6">
                                    {nextStep.next && !nextStep.next.locked ? (
                                        <Link
                                            href={nextStep.next.href}
                                            className={`${primaryButton} inline-flex max-w-full items-center gap-2`}
                                        >
                                            <span className="truncate">Next topic: {nextStep.next.title}</span>
                                            <span aria-hidden="true">→</span>
                                        </Link>
                                    ) : nextStep.next ? (
                                        <p className="text-sm text-muted-foreground">
                                            Next up is “{nextStep.next.title}”, but it&apos;s still locked.
                                        </p>
                                    ) : (
                                        <>
                                            <p className="mb-3 text-sm font-medium text-green-700">
                                                That was the last topic in this module. Well done! 🎓
                                            </p>
                                            <Link href={nextStep.moduleHref} className={`${primaryButton} inline-flex items-center`}>
                                                Back to module
                                            </Link>
                                        </>
                                    )}
                                    {nextStep.next && !nextStep.next.locked && nextStep.next.chapterTitle && (
                                        <p className="mt-2 text-xs text-muted-foreground">{nextStep.next.chapterTitle}</p>
                                    )}
                                </div>
                            )}

                            <div className="flex flex-wrap justify-center gap-4">
                                <button
                                    onClick={() => void start()}
                                    className={
                                        final?.passed && nextStep
                                            ? "neo-button px-6 py-3 font-medium text-foreground transition-all hover:opacity-90"
                                            : primaryButton
                                    }
                                >
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

                        {notes.status !== "idle" && (
                            <section className="mt-12 border-t border-border pt-8" aria-labelledby="missed-notes">
                                <h2 id="missed-notes" className="mb-1 text-xl font-bold text-foreground">
                                    Notes on what you missed
                                </h2>
                                <p className="mb-5 text-sm text-muted-foreground">
                                    Short explanations of the ideas behind the questions you got wrong. They&apos;re also in this
                                    topic&apos;s lesson, under &ldquo;Common mistakes explained&rdquo;.
                                </p>
                                {notes.status === "loading" && (
                                    <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-r-transparent" />
                                        Getting notes for the questions you missed…
                                    </p>
                                )}
                                {notes.status === "error" && (
                                    <p className="text-sm text-muted-foreground">Notes aren&apos;t available right now. Try the quiz again later.</p>
                                )}
                                {notes.status === "done" && notes.items.length === 0 && (
                                    <p className="text-sm text-muted-foreground">Notes for these questions are still being written. Check the lesson soon.</p>
                                )}
                                <div className="space-y-6">
                                    {notes.items.map(note => (
                                        <article key={note.questionId} className="rounded-2xl border border-border p-4 sm:p-5">
                                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                You missed: <span className="normal-case tracking-normal"><MathText text={note.question} /></span>
                                            </p>
                                            <TopicContentView content={note.html} />
                                        </article>
                                    ))}
                                </div>
                            </section>
                        )}

                        <div className="mt-12 border-t border-border pt-8">
                            <h2 className="mb-4 text-xl font-bold text-foreground">Detailed Review</h2>
                            <div className="space-y-4">
                                {questions.map((question, idx) => {
                                    const result = results[question.id]
                                    const typed = question.kind === "blank"
                                    const yourAnswer = typed
                                        ? selected[question.id] ? { text: selected[question.id] } : undefined
                                        : question.options.find(o => o.id === selected[question.id])
                                    const correctAnswer = typed
                                        ? result?.correctAnswerText ? { text: result.correctAnswerText } : undefined
                                        : question.options.find(o => o.id === result?.correctAnswerId)
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
                                                        <p>Your answer: {result && yourAnswer ? typed ? <code className="font-mono text-foreground">{yourAnswer.text}</code> : <MathText text={yourAnswer.text} /> : "Not answered"}</p>
                                                        {!isCorrect && correctAnswer && (
                                                            <p className="mt-1 font-medium text-green-700">
                                                                Correct answer: {typed ? <code className="font-mono">{correctAnswer.text}</code> : <MathText text={correctAnswer.text} />}
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
    const isTyped = current.kind === "blank"
    const hasSelected = !!selected[current.id]?.trim()
    const blankParts = isTyped ? splitBlankQuestion(current.text) : null
    const isLast = index === questions.length - 1
    const answeredCount = Object.keys(results).length

    return (
        <div className="-mt-5 pb-28 sm:mt-0 sm:px-4 sm:pt-4">
            <div className="mx-auto max-w-4xl">
                {backLink}
                <div className="mb-2 sm:mb-8">
                    <div className="neo-flat px-0 pb-4 pt-1 sm:p-6">
                        <div className="mb-3 flex items-center justify-between gap-4 sm:mb-4">
                            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
                            <div className="flex shrink-0 items-center gap-3">
                                <span className="text-sm text-muted-foreground">
                                    Question {index + 1} of {questions.length}
                                </span>
                                {leftMs !== null ? (
                                    <span
                                        role="timer"
                                        aria-label="Time left"
                                        className={`neo-pressed rounded-full px-3 py-1 font-mono text-sm font-semibold tabular-nums ${leftMs < 5 * 60_000 ? "text-red-600" : "text-foreground"}`}
                                    >
                                        ⏳ {formatClock(leftMs)} left
                                    </span>
                                ) : elapsedMs !== null && (
                                    <span
                                        role="timer"
                                        aria-label="Time taken so far"
                                        className="neo-pressed rounded-full px-3 py-1 font-mono text-sm font-semibold tabular-nums text-foreground"
                                        title={estimateMs ? `Estimated time: about ${Math.round(estimateMs / 60_000)} min` : undefined}
                                    >
                                        ⏱ {formatClock(elapsedMs)}
                                        {estimateMs !== null && (
                                            <span className="font-normal text-muted-foreground"> / ~{Math.round(estimateMs / 60_000)} min</span>
                                        )}
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

                <div className="neo-flat mb-6 px-0 py-3 sm:p-8">
                    <div className="mb-5 sm:mb-6">
                        <div className="mb-3 flex flex-wrap gap-2 sm:mb-4">
                            <span className="neo-pressed inline-block rounded-full px-3 py-1 text-xs font-medium text-muted-foreground">
                                {current.difficulty.toUpperCase()}
                            </span>
                            {current.topic && (
                                <span className="neo-pressed inline-block rounded-full px-3 py-1 text-xs font-medium text-muted-foreground">
                                    {current.topic.title}
                                </span>
                            )}
                        </div>
                        {current.paper && (
                            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Past paper · {current.paper}</p>
                        )}
                        {blankParts ? (
                            <>
                                {blankParts.prompt && (
                                    <h2 className="whitespace-pre-wrap text-xl font-semibold text-foreground"><MathText text={blankParts.prompt} /></h2>
                                )}
                                <p className="mt-1 text-sm text-muted-foreground">Type your answer in the blank{answered ? "" : ", then press Submit"}.</p>
                            </>
                        ) : (
                            <h2 className="whitespace-pre-wrap text-xl font-semibold text-foreground"><MathText text={current.text} /></h2>
                        )}
                    </div>

                    {blankParts && (
                        <CodeWithBlanks
                            key={current.id}
                            code={blankParts.code}
                            values={[selected[current.id] ?? ""]}
                            onChange={(_, value) => setSelected(prev => ({ ...prev, [current.id]: value }))}
                            states={[answered ? (result.isCorrect ? "right" : "wrong") : "idle"]}
                            disabled={answered || checking}
                            onEnter={() => void submitAnswer()}
                            label="Your answer"
                        />
                    )}

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
                            {result.isCorrect ? (
                                "✓ Correct! Well done."
                            ) : isTyped ? (
                                <>
                                    ✗ Not quite. The answer is{" "}
                                    <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[0.95em] text-foreground">{result.correctAnswerText ?? "-"}</code>
                                </>
                            ) : (
                                "✗ Not quite. The correct answer is highlighted in green."
                            )}
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
