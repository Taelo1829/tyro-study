"use client"

import Link from "next/link"
import { ChevronRight, Clock, GraduationCap, Target, Trophy, XCircle } from "lucide-react"
import type { ModuleProgress, QuizStats } from "@/lib/quiz-stats"
import { cn } from "@/lib/utils"
import { chapterSteps, moduleSteps } from "@/lib/progress-steps"

/** The JSON shape of ModuleProgress (dates arrive as strings) */
export type ModuleProgressData = Omit<ModuleProgress, never> & {
  mockInProgress?: { startedAt: string } | null
  student?: { name: string | null; email: string } | null
}

/** 45 s · 12 min · 1 h 05 min */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "-"
  const s = Math.round(seconds)
  if (s < 60) return `${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`
}

const scoreClass = (score: number | null, pass: number) =>
  score === null ? "text-muted-foreground" : score >= pass ? "text-green-700" : "text-orange-700"

/** A student's quiz tracking for one module: summary, mock exam, chapters and topics */
export function ProgressReport({ data, moduleHref, readOnly = false }: { data: ModuleProgressData; moduleHref: string; readOnly?: boolean }) {
  const s = data.summary
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-2 text-lg font-semibold">Module progress</h2>
        <ModuleProgressBar module={data} />
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile icon={Target} label="Chapters passed" value={`${s.chaptersPassed}/${s.chaptersWithQuiz}`} />
          <Tile icon={Trophy} label="Quizzes taken" value={String(s.quizzesTaken)} />
          <Tile icon={XCircle} label="Quizzes failed" value={String(s.quizzesFailed)} />
          <Tile icon={Clock} label="Time on quizzes" value={formatDuration(s.totalSeconds)} sub={`about ${formatDuration(s.secondsPerQuestion)} a question`} />
        </dl>
      </section>

      <MockExamCard data={data} moduleHref={moduleHref} readOnly={readOnly} />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Chapters and topics</h2>
        {data.chapters.length === 0 && <p className="text-sm text-muted-foreground">No chapters yet.</p>}
        {data.chapters.map((ch, ci) => (
          <details key={ch.id} className="group rounded-[1.5rem] border border-border bg-white" open={ci === 0}>
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4">
              <span className="min-w-0 flex-1 font-semibold">
                {ci + 1}. {ch.title}
              </span>
              {ch.pool > 0 ? (
                <span className="text-xs text-muted-foreground">
                  Chapter quiz:{" "}
                  <span className={cn("font-semibold", scoreClass(ch.stats.best, 70))}>{ch.stats.best === null ? "not taken" : `best ${ch.stats.best}%`}</span>
                  {ch.stats.attempts > 0 && ` · ${ch.stats.attempts} tries · ${ch.stats.failed} failed · avg ${formatDuration(ch.stats.averageSeconds)}`}
                  {" · "}estimate {formatDuration(ch.estimateSeconds)}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">No quiz questions yet</span>
              )}
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
              <ChapterProgressBar chapter={ch} className="w-full" />
            </summary>
            <div className="border-t border-border">
              <div className="hidden grid-cols-[minmax(0,1fr)_repeat(5,5.5rem)] gap-2 px-5 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
                <span>Topic</span>
                <span className="text-right">Best</span>
                <span className="text-right">Tries</span>
                <span className="text-right">Failed</span>
                <span className="text-right">Avg time</span>
                <span className="text-right">Last</span>
              </div>
              <ul className="divide-y divide-border">
                {ch.topics.map((t, ti) => (
                  <li key={t.id} className="px-5 py-3 text-sm sm:grid sm:grid-cols-[minmax(0,1fr)_repeat(5,5.5rem)] sm:items-center sm:gap-2">
                    <span className="block min-w-0 truncate font-medium sm:font-normal">
                      {ci + 1}.{ti + 1} {t.title}
                    </span>
                    {t.questions === 0 ? (
                      <span className="text-xs text-muted-foreground sm:col-span-5 sm:text-right">No quiz yet</span>
                    ) : (
                      <TopicStats stats={t.stats} />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ))}
      </section>
    </div>
  )
}

function TopicStats({ stats }: { stats: QuizStats }) {
  const cells: [string, React.ReactNode][] = [
    ["Best", <span key="b" className={cn("font-semibold", scoreClass(stats.best, 70))}>{stats.best === null ? "-" : `${stats.best}%`}</span>],
    ["Tries", stats.attempts],
    ["Failed", <span key="f" className={stats.failed ? "text-orange-700" : undefined}>{stats.failed}</span>],
    ["Avg time", formatDuration(stats.averageSeconds)],
    ["Last", stats.last ? `${stats.last.score}% · ${formatDuration(stats.last.seconds)}` : "-"],
  ]
  return (
    <>
      {/* Phone: one line of labelled values; wider: table cells */}
      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground sm:hidden">
        {cells.map(([label, value]) => (
          <span key={label}>
            {label}: <span className="text-foreground">{value}</span>
          </span>
        ))}
      </span>
      {cells.map(([label, value]) => (
        <span key={label} className="hidden text-right tabular-nums sm:block">
          {value}
        </span>
      ))}
    </>
  )
}

function Tile({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white px-4 py-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
      {sub && <dd className="text-xs text-muted-foreground">{sub}</dd>}
    </div>
  )
}

/** The mock exam: what it is, the student's results, and a start button */
export function MockExamCard({ data, moduleHref, readOnly = false }: { data: ModuleProgressData; moduleHref: string; readOnly?: boolean }) {
  const { plan, stats, passMark } = data.mock
  return (
    <section className="overflow-hidden rounded-[2rem] border-2 border-foreground bg-white">
      <div className="px-5 pb-4 pt-5">
        <p className="flex items-center gap-2 text-lg font-semibold">
          <GraduationCap className="h-5 w-5" />
          Mock exam
        </p>
        {plan ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              {plan.totalQuestions} questions from every chapter · {formatDuration(plan.timeLimitSeconds)} time limit · pass mark {passMark}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              The time comes from how long your chapter quizzes take
              {plan.capped ? ", shortened to the 3 hour maximum" : ""}. When time runs out the exam is handed in.
            </p>
            {stats.attempts > 0 && (
              <p className="mt-2 text-sm">
                Best <span className={cn("font-semibold", scoreClass(stats.best, passMark))}>{stats.best}%</span>
                <span className="text-muted-foreground">
                  {" "}· {stats.attempts} {stats.attempts === 1 ? "try" : "tries"} · {stats.failed} failed · last took {formatDuration(stats.last?.seconds)}
                </span>
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Available once this module has quiz questions.</p>
        )}
      </div>
      {plan && !readOnly && (
        <Link
          href={`${moduleHref}/mock-exam`}
          className="flex min-h-12 items-center justify-center gap-2 bg-foreground px-4 text-sm font-semibold text-background hover:bg-foreground/90"
        >
          {data.mockInProgress ? "Continue mock exam" : stats.attempts ? "Take the mock exam again" : "Start mock exam"}
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </section>
  )
}

export { chapterSteps, moduleSteps } from "@/lib/progress-steps"

/** A chapter's progress bar with "3/6 topic quizzes passed · chapter quiz passed" */
export function ChapterProgressBar({ chapter, className }: { chapter: Parameters<typeof chapterSteps>[0]; className?: string }) {
  const s = chapterSteps(chapter)
  if (s.total === 0) return <p className={cn("text-xs text-muted-foreground", className)}>No quizzes yet</p>
  const complete = s.done === s.total
  return (
    <div className={className}>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={s.percent}
        aria-label="Chapter progress"
      >
        <div className={cn("h-full rounded-full transition-all", complete ? "bg-green-600" : "bg-foreground")} style={{ width: `${s.percent}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        <span className={cn("font-semibold", complete ? "text-green-700" : "text-foreground")}>{s.percent}%</span>
        {s.topicCount > 0 && ` · ${s.topicsPassed}/${s.topicCount} topic quizzes passed`}
        {s.hasChapterQuiz && ` · chapter quiz ${s.chapterPassed ? "passed" : "not passed yet"}`}
      </p>
    </div>
  )
}

/** A module's progress bar: topic quizzes, chapter quizzes and the mock exam passed */
export function ModuleProgressBar({ module, className, size = "md" }: { module: Parameters<typeof moduleSteps>[0]; className?: string; size?: "sm" | "md" }) {
  const s = moduleSteps(module)
  if (s.total === 0) return <p className={cn("text-xs text-muted-foreground", className)}>No quizzes yet</p>
  return <StepsBar percent={s.percent} complete={s.done === s.total} label="Module progress" className={className} size={size} detail={[
    `${s.topicsPassed}/${s.topicCount} topic quizzes`,
    s.chapterQuizzes ? `${s.chaptersPassed}/${s.chapterQuizzes} chapter quizzes` : "",
    s.hasMock ? `mock exam ${s.mockPassed ? "passed" : "not passed yet"}` : "",
  ].filter(Boolean).join(" · ")} />
}

/** A percentage bar with a line of detail under it */
export function StepsBar({ percent, complete, label, detail, className, size = "md" }: { percent: number; complete: boolean; label: string; detail: string; className?: string; size?: "sm" | "md" }) {
  return (
    <div className={className}>
      <div
        className={cn("overflow-hidden rounded-full bg-muted", size === "sm" ? "h-1.5" : "h-2.5")}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label}
      >
        <div className={cn("h-full rounded-full transition-all", complete ? "bg-green-600" : "bg-foreground")} style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        <span className={cn("font-semibold", complete ? "text-green-700" : "text-foreground")}>{percent}%</span>
        {detail && ` · ${detail}`}
      </p>
    </div>
  )
}
