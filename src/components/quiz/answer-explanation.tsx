"use client"

import { useEffect, useState } from "react"
import { TopicContentView } from "@/components/topic/topic-content-view"

/** Mounted only after marking. Loading an explanation never blocks the next question. */
export function AnswerExplanation({ attemptId, questionId }: { attemptId: string; questionId: string }) {
  const [html, setHtml] = useState("")
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch("/api/quiz/explanation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId, questionId }),
          signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok || typeof data.html !== "string" || !data.html.trim()) {
          throw new Error(data.error || "Couldn't load the explanation.")
        }
        if (!controller.signal.aborted) setHtml(data.html)
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Couldn't load the explanation.")
      }
    }
    void load()
    return () => controller.abort()
  }, [attemptId, questionId, retry])

  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5" aria-label="Answer explanation" aria-busy={!html && !error}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold">Why this answer is correct</h3>
        <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">Draft explanation</span>
      </div>
      {html ? <TopicContentView content={html} /> : error ? (
        <div role="status" className="text-sm">
          <p className="text-muted-foreground">{error} Your answer has been saved.</p>
          <button type="button" className="mt-2 font-semibold underline underline-offset-4" onClick={() => { setError(""); setRetry(n => n + 1) }}>Retry explanation</button>
        </div>
      ) : <p role="status" className="text-sm text-muted-foreground">Preparing the explanation… You can continue when you’re ready.</p>}
    </section>
  )
}
