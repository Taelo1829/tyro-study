"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Eye, Loader2, RotateCcw, Terminal, XCircle } from "lucide-react"
import { CodeWithBlanks, type BlankState } from "./code-with-blanks"
import { cn } from "@/lib/utils"

/**
 * "Try it yourself" for coding lessons: short programs with blanks to fill in.
 * Each is checked on the server, which says which blanks are right; the
 * answers and an explanation show once it's all right, or on request.
 */

export interface PublicExercise {
  id: string
  title: string
  instructions: string
  code: string
  language: string
  blankCount: number
}

export function TryItYourself({ topicId, onCount }: { topicId: string; onCount?: (n: number) => void }) {
  const [exercises, setExercises] = useState<PublicExercise[] | null>(null)

  useEffect(() => {
    let live = true
    fetch(`/api/topics/${topicId}/exercises`)
      .then(res => (res.ok ? res.json() : { exercises: [] }))
      .then((data: { exercises?: PublicExercise[] }) => {
        if (!live) return
        setExercises(data.exercises ?? [])
        onCount?.(data.exercises?.length ?? 0)
      })
      .catch(() => live && setExercises([]))
    return () => {
      live = false
    }
  }, [topicId, onCount])

  if (!exercises || exercises.length === 0) return null

  return (
    <section className="mt-10 border-t border-border pt-8" aria-labelledby="try-it">
      <div className="mb-6">
        <h2 id="try-it" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Terminal className="h-5 w-5" />
          Try it yourself
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fill in the blanks so the code does what it says, then check your answer. Spacing doesn&apos;t matter.
        </p>
      </div>
      <div className="space-y-6">
        {exercises.map((e, i) => (
          <Exercise key={e.id} exercise={e} number={i + 1} />
        ))}
      </div>
    </section>
  )
}

interface CheckResult {
  results: boolean[]
  correct: boolean
  answers?: string[]
  explanation?: string | null
}

function Exercise({ exercise, number }: { exercise: PublicExercise; number: number }) {
  const empty = () => Array<string>(exercise.blankCount).fill("")
  const [values, setValues] = useState<string[]>(empty)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [tries, setTries] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  // Changed since the last check: the marks no longer apply
  const [dirty, setDirty] = useState(false)

  const filled = values.every(v => v.trim())

  async function check(reveal = false) {
    if (busy || (!reveal && !filled)) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/exercises/${exercise.id}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: values, reveal }),
      })
      const data = (await res.json().catch(() => ({}))) as CheckResult & { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Couldn't check your answer")
      setResult(data)
      setDirty(false)
      if (!reveal) setTries(t => t + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check your answer")
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setValues(empty())
    setResult(null)
    setDirty(false)
    setError("")
  }

  const states: BlankState[] = values.map((_, i) => (!result || dirty ? "idle" : result.results[i] ? "right" : "wrong"))
  const rightCount = result?.results.filter(Boolean).length ?? 0
  const solved = !!result?.correct && !dirty
  const revealed = !!result?.answers && !result.correct

  return (
    <article className={cn("rounded-[1.5rem] border-2 p-4 sm:p-5", solved ? "border-green-600" : "border-border")}>
      <h3 className="font-semibold">
        {number}. {exercise.title}
      </h3>
      {exercise.instructions && <p className="mt-1 text-sm text-muted-foreground">{exercise.instructions}</p>}

      <CodeWithBlanks
        code={exercise.code}
        values={values}
        states={states}
        disabled={busy || solved}
        onEnter={() => void check()}
        onChange={(i, v) => {
          setValues(prev => prev.map((x, j) => (j === i ? v : x)))
          if (result) setDirty(true)
        }}
        className="mt-3"
      />

      {result && !dirty && (
        <div
          role="status"
          className={cn(
            "mt-3 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm",
            result.correct ? "bg-green-50 text-green-900" : "bg-red-50 text-red-800"
          )}
        >
          {result.correct ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <div className="space-y-1">
            <p className="font-semibold">
              {result.correct
                ? tries <= 1 ? "Correct, first time!" : "Correct!"
                : revealed
                  ? "Here are the answers"
                  : exercise.blankCount > 1
                    ? `Not quite: ${rightCount} of ${exercise.blankCount} blanks are right. Fix the red ones and check again.`
                    : "Not quite. Have another go."}
            </p>
            {revealed && result.answers && (
              <ul className="font-mono text-[0.85rem]">
                {result.answers.map((a, i) => (
                  <li key={i}>
                    {exercise.blankCount > 1 && `Blank ${i + 1}: `}
                    <span className="font-semibold">{a}</span>
                  </li>
                ))}
              </ul>
            )}
            {result.explanation && <p className={result.correct ? "text-green-900" : "text-foreground"}>{result.explanation}</p>}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!solved && (
          <button
            type="button"
            onClick={() => void check()}
            disabled={busy || !filled}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Check answer
          </button>
        )}
        {tries > 0 && !result?.correct && !revealed && (
          <button
            type="button"
            onClick={() => void check(true)}
            disabled={busy}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            <Eye className="h-4 w-4" />
            Show answer
          </button>
        )}
        {(result || values.some(v => v)) && (
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4" />
            {solved ? "Try again" : "Clear"}
          </button>
        )}
      </div>
    </article>
  )
}
