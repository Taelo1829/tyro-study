import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { RANGES, asRange, getAnalyticsReport, type AnalyticsReport, type CountRow } from "@/lib/analytics-report"
import { requireAdminPage } from "@/lib/admin"

export const dynamic = "force-dynamic"

/**
 * Product analytics for admins: activation, return rates, weekly active
 * learners, the sign-up funnel, quizzes, pages and traffic sources.
 * Data comes from src/lib/analytics-report.ts (admins' own use is left out).
 */

const dateFormat = new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeZone: "Africa/Johannesburg" })
const weekFormat = new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short" })

const EVENT_LABELS: Record<string, string> = {
  page_view: "Page viewed",
  sign_up_started: "Sign-up started",
  sign_up: "Signed up",
  login: "Signed in",
  module_joined: "Module joined",
  module_left: "Module left",
  lesson_opened: "Lesson opened",
  topic_tab_viewed: "Topic tab opened",
  quiz_started: "Quiz started",
  quiz_completed: "Quiz completed",
  push_enabled: "Notifications turned on",
  message_sent: "Chat message sent",
  friend_request_sent: "Friend request sent",
  friend_request_accepted: "Friend request accepted",
  assignment_submitted: "Assignment submitted",
  project_submitted: "Project submitted",
  exercise_checked: "Exercise checked",
  app_installed: "App installed",
  web_vital: "Performance sample",
  feedback_sent: "Feedback sent",
}

const QUIZ_LABELS: Record<string, string> = {
  topic: "Topic quiz",
  chapter: "Chapter quiz",
  mock_exam: "Mock exam",
  module: "Module quiz",
  custom: "Custom / review",
}

function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–"
}

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireAdminPage()
  const days = asRange((await searchParams).days)

  let report: AnalyticsReport | null = null
  let problem: string | null = null
  try {
    report = await getAnalyticsReport(days)
  } catch (err) {
    console.error("Analytics report failed:", err)
    problem = err instanceof Error && /analytics_events/.test(err.message)
      ? "The analytics table doesn't exist yet. Run `npx prisma migrate deploy` (and `npx prisma generate`), then reload."
      : "Couldn't load the analytics. Check the server logs."
  }

  return (
    <>
      <Header title="Analytics" subtitle="How students find, start and keep using Tyro Study" />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link href="/admin" className="mr-2 text-sm text-muted-foreground hover:underline">← Admin</Link>
        {RANGES.map(r => (
          <Link
            key={r}
            href={`/admin/analytics?days=${r}`}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium ring-1 ring-border",
              r === days ? "bg-primary text-primary-foreground ring-primary" : "hover:bg-muted"
            )}
          >
            Last {r} days
          </Link>
        ))}
      </div>

      {problem || !report ? (
        <Card><p className="text-sm">{problem}</p></Card>
      ) : (
        <Report report={report} />
      )}
    </>
  )
}

function Report({ report }: { report: AnalyticsReport }) {
  const { overview: o, cohort: c, days } = report

  if (!o.firstEventAt) {
    return (
      <Card>
        <p className="font-medium">No events yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tracking is on. Numbers appear here as soon as students visit, sign up and take quizzes.
        </p>
      </Card>
    )
  }

  const funnel = [
    { label: "Signed up", value: c.signUps },
    { label: "Joined a module", value: c.joinedModule },
    { label: "Opened a lesson", value: c.openedLesson },
    { label: "Started a quiz", value: c.startedQuiz },
    { label: "Passed a quiz", value: c.passedQuiz },
  ]
  // The step that loses the most people (the one to fix first)
  let worst = -1
  let worstDrop = 0
  funnel.forEach((step, i) => {
    if (i === 0) return
    const prev = funnel[i - 1].value
    const drop = prev > 0 ? (prev - step.value) / prev : 0
    if (drop > worstDrop) {
      worstDrop = drop
      worst = i
    }
  })

  const maxWeek = Math.max(1, ...report.weeks.map(w => w.activeLearners))

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Tracking since {dateFormat.format(new Date(o.firstEventAt))}. Admin activity is not counted. Days are in South African time.
      </p>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Metric
          label="Activation"
          value={pct(c.activated, c.activationEligible)}
          detail={`${c.activated} of ${c.activationEligible} new students passed a quiz within 24 h of signing up`}
          target="Target 40%+"
        />
        <Metric
          label="Day-1 return"
          value={pct(c.d1Returned, c.d1Eligible)}
          detail={`${c.d1Returned} of ${c.d1Eligible} came back the day after signing up`}
          target="Target 30%+"
        />
        <Metric
          label="Day-7 return"
          value={pct(c.d7Returned, c.d7Eligible)}
          detail={`${c.d7Returned} of ${c.d7Eligible} came back within 7 days`}
          target="Target 20%+"
        />
        <Metric
          label="Weekly active learners"
          value={String(o.weeklyActiveLearners)}
          detail="Opened a lesson or finished a quiz in the last 7 days"
          target="Rising week on week"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Metric label="Visitors" value={String(o.visitors)} detail={`${o.pageViews} page views in the last ${days} days`} />
        <Metric label="Sign-ups" value={String(o.signUps)} detail={`${o.signUpsStarted} started the sign-up form`} />
        <Metric label="Visitor → sign-up" value={pct(o.signUps, o.visitors)} detail="Sign-ups divided by visitors" target="Target 3–5%" />
        <Metric label="Active users" value={String(o.activeUsers)} detail={`Signed-in students who did anything in the last ${days} days`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Funnel */}
        <Card>
          <h2 className="font-semibold">New student funnel</h2>
          <p className="mb-4 text-xs text-muted-foreground">Students who signed up in the last {days} days, and how far they got</p>
          {c.signUps === 0 ? (
            <p className="text-sm text-muted-foreground">No sign-ups in this period.</p>
          ) : (
            <ol className="space-y-3">
              {funnel.map((step, i) => (
                <li key={step.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className={cn(i === worst && "font-semibold")}>
                      {step.label}
                      {i === worst && <span className="ml-2 text-xs font-medium text-red-600">biggest drop</span>}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {step.value} · {pct(step.value, c.signUps)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: pct(step.value, c.signUps).replace("–", "0%") }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        {/* Weekly trend */}
        <Card>
          <h2 className="font-semibold">Last 8 weeks</h2>
          <p className="mb-4 text-xs text-muted-foreground">Active learners per week (Monday to Sunday), with sign-ups and quizzes passed</p>
          <ul className="space-y-2">
            {report.weeks.map(w => (
              <li key={w.week} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 text-sm">
                <span className="text-muted-foreground">{weekFormat.format(new Date(`${w.week}T12:00:00`))}</span>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.round((w.activeLearners / maxWeek) * 100)}%` }} />
                </div>
                <span className="whitespace-nowrap text-right tabular-nums text-xs text-muted-foreground">
                  <strong className="text-foreground">{w.activeLearners}</strong> active · {w.signUps} new · {w.quizzesPassed} passed
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Quizzes */}
      <Card>
        <h2 className="mb-4 font-semibold">Quizzes</h2>
        {report.quizzes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quizzes in this period.</p>
        ) : (
          <Table
            head={["Kind", "Started", "Finished", "Finish rate", "Passed", "Pass rate", "Avg score"]}
            rows={report.quizzes.map(q => [
              QUIZ_LABELS[q.kind] ?? q.kind,
              q.started,
              q.completed,
              pct(q.completed, q.started),
              q.passed,
              pct(q.passed, q.completed),
              q.avgScore === null ? "–" : `${q.avgScore}%`,
            ])}
          />
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Top pages</h2>
          <Table head={["Page", "Views", "Visitors"]} rows={report.pages.map(p => [p.page, p.views, p.visitors])} empty="No page views yet." />
        </Card>
        <Card>
          <h2 className="mb-1 font-semibold">Where visits come from</h2>
          <p className="mb-4 text-xs text-muted-foreground">The referring site (or utm_source) when someone opens Tyro Study</p>
          <Table head={["Source", "Visits", "Visitors"]} rows={report.sources.map(s => [s.source, s.visits, s.visitors])} empty="No visits yet." />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">All events</h2>
          <CountTable rows={report.events} labels={EVENT_LABELS} />
        </Card>
        <Card>
          <h2 className="mb-1 font-semibold">Topic tabs used</h2>
          <p className="mb-4 text-xs text-muted-foreground">Which parts of a topic students open besides the lesson</p>
          <CountTable rows={report.tabs} first="Tab" />
        </Card>
      </div>
    </div>
  )
}

function Metric({ label, value, detail, target }: { label: string; value: string; detail: string; target?: string }) {
  return (
    <Card className="h-full p-4 sm:p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-primary sm:text-3xl">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
      {target && <p className="mt-1 text-xs font-medium">{target}</p>}
    </Card>
  )
}

function Table({ head, rows, empty = "Nothing yet." }: { head: string[]; rows: (string | number)[][]; empty?: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={head.join(", ")}>
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            {head.map((h, i) => (
              <th key={h} className={cn("whitespace-nowrap pb-2 font-medium", i > 0 && "pl-4 text-right")}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-border/60 last:border-0">
              {row.map((cell, i) => (
                <td key={i} className={cn("py-2", i === 0 ? "max-w-[16rem] truncate" : "whitespace-nowrap pl-4 text-right tabular-nums")}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CountTable({ rows, labels, first = "Event" }: { rows: CountRow[]; labels?: Record<string, string>; first?: string }) {
  return (
    <Table
      head={[first, "Count", "Students"]}
      rows={rows.map(r => [labels?.[r.name] ?? r.name, r.count, r.users])}
    />
  )
}
