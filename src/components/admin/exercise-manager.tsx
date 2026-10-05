"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CodeWithBlanks } from "@/components/exercises/code-with-blanks"

/**
 * Admin: a topic's "Try it yourself" exercises (fill in the blanks in a short
 * program, shown after the lesson in coding modules), and the AI button that
 * also writes type-the-answer quiz questions.
 */

interface Exercise {
  id: string
  title: string
  instructions: string
  code: string
  blanks: { answers: string[] }[]
  explanation: string | null
}

const select = "rounded-full border border-border bg-white px-3 py-1.5 text-sm"

export function ExerciseManager({ topicId, onCount, onQuestionsAdded }: { topicId: string; onCount?: (n: number) => void; onQuestionsAdded?: () => void }) {
  const [coding, setCoding] = useState<boolean | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [count, setCount] = useState(2)
  const [questions, setQuestions] = useState(5)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const load = useCallback(async () => {
    const res = await fetch(`/api/topics/${topicId}/exercises`)
    if (!res.ok) return
    const data = (await res.json()) as { coding: { language: string | null }; exercises: Exercise[] }
    setCoding(!!data.coding.language)
    setExercises(data.exercises)
    onCount?.(data.exercises.length)
  }, [topicId, onCount])

  useEffect(() => {
    queueMicrotask(load)
  }, [load])

  async function generate() {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const res = await fetch(`/api/topics/${topicId}/exercises/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exercises: count, questions }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Couldn't write the exercises")
      const parts = [
        count ? `${data.exercises} exercise${data.exercises === 1 ? "" : "s"}` : "",
        questions ? `${data.questions} type-the-answer question${data.questions === 1 ? "" : "s"}` : "",
      ].filter(Boolean)
      setMessage(data.exercises || data.questions ? `Added ${parts.join(" and ")}.` : "The AI didn't come up with usable ones. Try again.")
      if (data.questions) onQuestionsAdded?.()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't write the exercises")
    } finally {
      setBusy(false)
    }
  }

  async function remove(e: Exercise) {
    if (!confirm(`Delete the exercise "${e.title}"?`)) return
    const res = await fetch(`/api/exercises/${e.id}`, { method: "DELETE" })
    if (res.ok) await load()
  }

  if (coding === null) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!coding) {
    return (
      <p className="rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
        &ldquo;Try it yourself&rdquo; exercises are for coding modules. To make this one a coding module, open the module and use Edit
        module › Coding module.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Short programs with blanks to fill in, shown after the lesson and checked instantly. The AI can also write quiz questions
          that students answer by typing into a blank in the code; they join this topic&apos;s quiz.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            Exercises
            <select value={count} onChange={e => setCount(Number(e.target.value))} disabled={busy} className={select}>
              {[0, 1, 2, 3, 4, 5].map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            Type-the-answer questions
            <select value={questions} onChange={e => setQuestions(Number(e.target.value))} disabled={busy} className={select}>
              {[0, 3, 5, 10].map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <Button variant="primary" onClick={generate} disabled={busy || count + questions === 0}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Writing…" : "Generate with AI"}
          </Button>
        </div>
        {message && <p className="text-sm text-green-700">{message}</p>}
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <h3 className="font-semibold">Exercises ({exercises.length})</h3>
        {exercises.length === 0 && <p className="text-sm text-muted-foreground">No exercises yet.</p>}
        {exercises.map((e, i) => (
          <div key={e.id} className="rounded-2xl border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {i + 1}. {e.title}
                </p>
                {e.instructions && <p className="mt-0.5 text-sm text-muted-foreground">{e.instructions}</p>}
              </div>
              <button
                type="button"
                onClick={() => remove(e)}
                className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                aria-label={`Delete ${e.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {/* Shown with the first accepted answer in each blank */}
            <CodeWithBlanks
              code={e.code}
              values={e.blanks.map(b => b.answers[0] ?? "")}
              states={e.blanks.map(() => "right")}
              onChange={() => {}}
              disabled
              className="mt-3"
            />
            <ul className="mt-2 space-y-0.5 text-sm">
              {e.blanks.map((b, j) => (
                <li key={j}>
                  <span className="text-muted-foreground">{e.blanks.length > 1 ? `Blank ${j + 1} accepts: ` : "Accepts: "}</span>
                  <span className="font-mono">{b.answers.join("  ·  ")}</span>
                </li>
              ))}
            </ul>
            {e.explanation && <p className="mt-2 text-sm text-muted-foreground">{e.explanation}</p>}
          </div>
        ))}
      </section>
    </div>
  )
}
