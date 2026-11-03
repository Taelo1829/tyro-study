import { Header } from "@/components/layout/header"
import { DashboardWidget } from "@/components/dashboard/dashboard-widget"
import { StudyProgressDonut } from "@/components/dashboard/study-progress-donut"
import { Flame, BookOpen, Calendar, ClipboardList, ChevronRight } from "lucide-react"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { moduleProgress } from "@/lib/quiz-stats"
import { getOnboardingState } from "@/lib/onboarding"
import { getTopicUpNext } from "@/lib/topic-up-next"
import { moduleSteps } from "@/lib/progress-steps"
import { recordDailyVisit } from "@/lib/streak"
import { listCalendarEvents, type CalendarEventRow } from "@/lib/calendar"
import Link from "next/link"
import { getUserLevel, moduleLevels } from "@/lib/levels-server"
import { termsFor, type StudyLevel } from "@/lib/levels"

/**
 * Overall progress across the student's modules, counted the same way as the
 * module progress bars: topic quizzes, chapter quizzes and mock exams passed.
 */
async function getStudyProgressPercent(userId: string, ofLevel: (moduleId: string) => boolean) {
  const enrollments = (await prisma.moduleEnrollment.findMany({
    where: { userId },
    select: { moduleId: true },
  })).filter(e => ofLevel(e.moduleId))
  if (enrollments.length === 0) return 0

  const steps = await Promise.all(
    enrollments.map(async ({ moduleId }) => {
      const progress = await moduleProgress(userId, moduleId)
      return progress ? moduleSteps(progress) : { done: 0, total: 0 }
    })
  )
  const total = steps.reduce((n, s) => n + s.total, 0)
  const done = steps.reduce((n, s) => n + s.done, 0)
  return total ? Math.round((done / total) * 100) : 0
}

async function getCurrentStreakDays(userId: string) {
  const user = await recordDailyVisit(userId)
  return user?.streakDays ?? 0
}

// Timetable entries are shown in South African time (SA has no daylight saving)
const SA_TZ = "Africa/Johannesburg"
const saTime = new Intl.DateTimeFormat("en-ZA", { timeZone: SA_TZ, hour: "2-digit", minute: "2-digit" })
const saDay = new Intl.DateTimeFormat("en-ZA", { timeZone: SA_TZ, weekday: "short", day: "numeric", month: "short" })

function startOfTodaySA() {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: SA_TZ }).format(new Date()) // YYYY-MM-DD
  return new Date(`${ymd}T00:00:00+02:00`)
}

async function getTimetableSummary(userId: string) {
  const todayStart = startOfTodaySA()
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000)
  const inTwoWeeks = new Date(todayStart.getTime() + 15 * 86_400_000)
  try {
    const [today, soon] = await Promise.all([
      listCalendarEvents(userId, todayStart.toISOString(), tomorrowStart.toISOString()),
      listCalendarEvents(userId, new Date().toISOString(), inTwoWeeks.toISOString()),
    ])
    return {
      today: today.filter(e => !e.completed),
      dueSoon: soon.filter(e => !e.completed && (e.type === "ASSIGNMENT" || e.type === "EXAM")).slice(0, 4),
    }
  } catch (error) {
    // e.g. the calendar migration hasn't been run yet - don't break the dashboard
    console.error("Timetable summary failed:", error)
    return { today: [] as CalendarEventRow[], dueSoon: [] as CalendarEventRow[] }
  }
}

function timeLabel(e: CalendarEventRow) {
  if (e.allDay) return "All day"
  const start = saTime.format(new Date(e.startAt))
  if (e.type === "ASSIGNMENT") return `Due ${start}`
  return e.endAt ? `${start} – ${saTime.format(new Date(e.endAt))}` : start
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id

  if (!userId) {
    redirect("/login")
  }

  // Only the modules (or subjects) of the student's level: high school or university
  const [level, levels] = await Promise.all([getUserLevel(userId), moduleLevels()])
  const ofLevel = (moduleId: string) => (levels.get(moduleId) ?? "tertiary") === level
  const t = termsFor(level as StudyLevel)

  const dayStart = startOfTodaySA()
  const [studyProgressPercent, currentStreakDays, topicUpNext, timetable, setup, answeredToday] = await Promise.all([
    getStudyProgressPercent(userId, ofLevel),
    getCurrentStreakDays(userId),
    getTopicUpNext(userId, ofLevel),
    getTimetableSummary(userId),
    getOnboardingState(userId),
    prisma.questionAttempt.count({ where: { quizAttempt: { userId }, status: "ANSWERED", answeredAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 86_400_000) } } }),
  ])

  return (
    // The one page that keeps a grey background and real cards (globals.css)
    <div data-page-bg="grey" data-keep-cards>
      <Header
        title="Dashboard"
        subtitle="Your study overview for today"
      />

      <section aria-labelledby="up-next-heading" className="mb-6 rounded-3xl bg-black p-6 text-white sm:p-8 lg:p-10">
        <div className="mb-5 flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-white/70" aria-hidden="true" />
          <h2 id="up-next-heading" className="text-sm font-semibold uppercase tracking-widest">Up Next</h2>
        </div>
        {topicUpNext ? (
          <Link
            href={`/modules/${topicUpNext.moduleId}/topics/${topicUpNext.id}`}
            className="group flex flex-col items-start justify-between gap-6 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-white sm:flex-row sm:items-center"
          >
            <div className="min-w-0">
              <p className="mb-2 text-sm text-white/70">{topicUpNext.moduleTitle} / {topicUpNext.chapterTitle}</p>
              <h3 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">{topicUpNext.title}</h3>
              {topicUpNext.totalQuestions > 0 && (
                <p className="mt-4 text-sm text-white/70">
                  {topicUpNext.answered}/{topicUpNext.totalQuestions} questions answered
                </p>
              )}
            </div>
            <span className="inline-flex shrink-0 items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black">
              {topicUpNext.answered > 0 ? "Continue studying" : "Start studying"}
              <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </Link>
        ) : (
          <div>
            <h3 className="text-2xl font-semibold sm:text-3xl">No topics available yet</h3>
            <p className="mt-3 text-white/70">Explore your {t.modules} to find your next study topic.</p>
            <Link href="/modules" className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              Browse {t.modules}<ChevronRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DashboardWidget
          title="Study Progress"
          description={`Quizzes passed across your ${t.modules}`}
          delay={0}
          tone="blue"
        >
          <StudyProgressDonut percent={studyProgressPercent} />
        </DashboardWidget>

        <DashboardWidget
          title="Current Streak"
          description="Consecutive study days"
          delay={0.05}
          tone="mint"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card">
              <Flame className="h-7 w-7 text-orange" />
            </div>
            <div>
              <p className="text-4xl font-semibold">{currentStreakDays}</p>
              <p className="text-sm text-muted-foreground">days in a row</p>
            </div>
          </div>
        </DashboardWidget>

        {setup.dailyGoal && (
          <DashboardWidget title="Daily goal" description="Quiz questions answered today" tone="slate">
            <p className="text-3xl font-semibold">{answeredToday}<span className="text-lg font-normal text-muted-foreground"> / {setup.dailyGoal}</span></p>
            <progress aria-label="Daily question goal" className="mt-4 h-2 w-full accent-black" max={setup.dailyGoal} value={Math.min(answeredToday, setup.dailyGoal)} />
            <p className="mt-2 text-sm text-muted-foreground">{answeredToday >= setup.dailyGoal ? "Daily goal reached. Nicely done!" : `${setup.dailyGoal - answeredToday} more to reach your goal.`}</p>
          </DashboardWidget>
        )}

        <DashboardWidget
          title="Today&apos;s Study Plan"
          description="From your timetable"
          delay={0.15}
        >
          {timetable.today.length === 0 ? (
            <Link href="/timetable" className="group flex items-start gap-3">
              <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground group-hover:text-foreground">
                Nothing planned for today. Plan a study session →
              </p>
            </Link>
          ) : (
            <ul className="space-y-2">
              {timetable.today.slice(0, 4).map(e => {
                // A study session for a module goes straight to that module
                const toModule = e.type === "STUDY_SESSION" && !!e.moduleId
                const Icon = toModule ? BookOpen : Calendar
                return (
                  <li key={e.id}>
                    <Link
                      href={toModule ? `/modules/${e.moduleId}` : "/timetable"}
                      className="flex items-center gap-3 rounded-2xl bg-muted px-3 py-2 hover:bg-tint-blue"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{e.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {timeLabel(e)}{e.moduleTitle && ` · ${e.moduleTitle}`}
                        </span>
                      </span>
                      {toModule && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    </Link>
                  </li>
                )
              })}
              {timetable.today.length > 4 && (
                <li className="px-1 text-xs text-muted-foreground">+{timetable.today.length - 4} more today</li>
              )}
            </ul>
          )}
        </DashboardWidget>

        <DashboardWidget
          title="Upcoming Assignments"
          description="Assignments and exams in the next two weeks"
          delay={0.2}
        >
          {timetable.dueSoon.length === 0 ? (
            <Link href="/timetable" className="group flex items-start gap-3">
              <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground group-hover:text-foreground">
                Nothing due in the next two weeks. Add a due date →
              </p>
            </Link>
          ) : (
            <ul className="space-y-2">
              {timetable.dueSoon.map(e => (
                <li key={e.id}>
                  <Link href="/timetable" className="flex items-center gap-3 rounded-2xl bg-muted px-3 py-2 hover:bg-orange-50">
                    <ClipboardList className="h-4 w-4 shrink-0 text-orange" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {e.type === "EXAM" ? "Exam: " : ""}{e.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {saDay.format(new Date(e.startAt))} · {timeLabel(e)}{e.moduleTitle && ` · ${e.moduleTitle}`}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardWidget>
      </div>
    </div>
  )
}
