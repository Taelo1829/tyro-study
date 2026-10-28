"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, ListChecks, RotateCcw, X } from "lucide-react"
import { MathText } from "@/components/ui/math-text"
import { cn } from "@/lib/utils"
import type { SampleQuestion } from "@/lib/public-quiz"

/**
 * Short "test yourself" quiz under a public lesson. Answers are marked as soon
 * as an option is picked; once every question is answered it shows the score
 * and invites the reader to sign in for the full quiz.
 */
export function SampleQuiz({
  questions,
  total,
  siteName,
}: {
  questions: SampleQuestion[]
  total: number
  siteName: string
}) {
  const [picked, setPicked] = useState<Record<string, string>>({})

  const answered = questions.filter(q => picked[q.id]).length
  const correct = questions.filter(q => picked[q.id] === q.correctId).length
  const done = answered === questions.length
  const more = Math.max(0, total - questions.length)

  return (
    <section aria-labelledby="sample-quiz" className="mt-12 rounded-2xl border border-border p-5 sm:p-6">
      <h2 id="sample-quiz" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <ListChecks className="h-5 w-5" aria-hidden="true" /> Test yourself
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {questions.length} quick question{questions.length !== 1 ? "s" : ""} on this lesson. Pick an answer to see if you&apos;re right.
      </p>

      <ol className="mt-6 space-y-8">
        {questions.map((q, i) => {
          const choice = picked[q.id]
          return (
            <li key={q.id}>
              <p className="whitespace-pre-wrap font-medium">
                {i + 1}. <MathText text={q.text} />
              </p>
              <div className="mt-3 grid gap-2" role="group" aria-label={`Question ${i + 1} options`}>
                {q.options.map(option => {
                  const isPicked = choice === option.id
                  const isRight = option.id === q.correctId
                  const state = !choice ? "idle" : isRight ? "right" : isPicked ? "wrong" : "other"
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={!!choice}
                      onClick={() => setPicked(prev => ({ ...prev, [q.id]: option.id }))}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                        state === "idle" && "border-border hover:border-foreground/40 hover:bg-muted",
                        state === "right" && "border-green-300 bg-green-50 text-green-900",
                        state === "wrong" && "border-red-300 bg-red-50 text-red-800",
                        state === "other" && "border-border opacity-60"
                      )}
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                        {state === "right" && <Check className="h-4 w-4" />}
                        {state === "wrong" && <X className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1"><MathText text={option.text} /></span>
                    </button>
                  )
                })}
              </div>
              {choice && (
                <p className={cn("mt-2 text-sm font-medium", choice === q.correctId ? "text-green-700" : "text-red-700")} role="status">
                  {choice === q.correctId ? "Correct!" : "Not quite. The right answer is highlighted in green."}
                </p>
              )}
            </li>
          )
        })}
      </ol>

      {done && (
        <div className="mt-8 rounded-2xl bg-muted/60 p-5" role="status">
          <p className="text-lg font-semibold">
            You got {correct} out of {questions.length}
            {correct === questions.length ? ". Nice work!" : "."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {more > 0
              ? `There are ${more} more question${more !== 1 ? "s" : ""} on this topic. `
              : "That's a taste of the topic quiz. "}
            Sign in or create a free {siteName} account to take the full quiz, get study notes on the questions you miss, review
            flashcards and track your progress.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/register" className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/85">
              Create a free account
            </Link>
            <Link href="/login" className="rounded-full px-5 py-2.5 text-sm font-medium ring-1 ring-border hover:bg-white">
              Sign in
            </Link>
            <button
              type="button"
              onClick={() => setPicked({})}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-white hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Try again
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
