"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AlertCircle, Clock, FileQuestion, GraduationCap, Trophy } from "lucide-react"
import { QuizRunner } from "@/components/quiz/quiz-runner"
import { Button } from "@/components/ui/button"
import { formatDuration, type ModuleProgressData } from "@/components/progress/progress-report"

/**
 * The mock exam (module quiz): questions from every chapter with a real time
 * limit worked out from the student's chapter quiz times (at most 3 hours).
 * The clock starts when they press Start; an unfinished exam carries on.
 */
export default function MockExamPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<ModuleProgressData | null>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    let live = true
    fetch(`/api/progress/module/${id}`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: ModuleProgressData | null) => {
        if (!live || !d) return
        setData(d)
        // Already writing it (e.g. after a refresh): straight back in
        if (d.mockInProgress) setStarted(true)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [id])

  if (started) {
    return <QuizRunner source={{ moduleId: id }} title="Mock exam" backHref={`/modules/${id}`} backLabel="Back to module" />
  }
  if (!data) return <p className="px-4 text-sm text-muted-foreground">Loading…</p>

  const plan = data.mock.plan
  return (
    <div className="mx-auto max-w-2xl px-1 py-4">
      <Link href={`/modules/${id}`} className="text-sm text-muted-foreground hover:text-primary">
        ← Back to module
      </Link>
      <div className="mt-4 overflow-hidden rounded-[2rem] border-2 border-foreground bg-white">
        <div className="space-y-5 px-6 py-6">
          <div>
            <p className="flex items-center gap-2 text-2xl font-semibold">
              <GraduationCap className="h-6 w-6" />
              Mock exam
            </p>
            <p className="mt-1 text-muted-foreground">{data.title}</p>
          </div>
          {!plan ? (
            <p className="text-sm text-muted-foreground">This module has no quiz questions yet.</p>
          ) : (
            <>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <FileQuestion className="h-4 w-4" /> {plan.totalQuestions} questions from all {plan.perChapter.length} chapters
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4" /> {formatDuration(plan.timeLimitSeconds)} time limit
                </li>
                <li className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" /> Pass mark {data.mock.passMark}%
                </li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Each chapter gets as many questions as its chapter quiz, and as much time as your chapter quizzes take
                {plan.capped ? ". Together that came to more than 3 hours, so every chapter's share was shortened to fit 3 hours" : ""}.
              </p>
              <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                The clock starts when you press Start and keeps running if you leave the page. When time runs out, the exam is handed
                in and unanswered questions count as wrong.
              </p>
              {data.mock.stats.attempts > 0 && (
                <p className="text-sm">
                  Your best: <span className="font-semibold">{data.mock.stats.best}%</span> · {data.mock.stats.attempts} tries ·{" "}
                  {data.mock.stats.failed} failed
                </p>
              )}
            </>
          )}
        </div>
        {plan && (
          <Button variant="primary" size="lg" className="h-14 w-full rounded-none text-base" onClick={() => setStarted(true)}>
            Start mock exam
          </Button>
        )}
      </div>
    </div>
  )
}
