import { Header } from "@/components/layout/header"
import { DashboardWidget } from "@/components/dashboard/dashboard-widget"
import { StudyProgressDonut } from "@/components/dashboard/study-progress-donut"
import { Flame, BookOpen, Calendar, ClipboardList, ChevronRight } from "lucide-react"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { recordDailyVisit } from "@/lib/streak"
import { listCalendarEvents, type CalendarEventRow } from "@/lib/calendar"
import Link from "next/link"

const TOPIC_COMPLETION_THRESHOLD = 0.7

interface TopicUpNext {
  id: string
  title: string
  moduleId: string
  moduleTitle: string
  chapterTitle: string
  answered: number
  totalQuestions: number
}

async function getStudyProgressPercent(userId: string) {
  const enrollments = await prisma.moduleEnrollment.findMany({
    where: { userId },
    select: { moduleId: true },
  })

  const moduleIds = enrollments.map((enrollment) => enrollment.moduleId)
  if (moduleIds.length === 0) return 0

  const totalQuestions = await prisma.question.count({
    where: {
      topic: {
        chapter: {
          moduleId: { in: moduleIds },
        },
      },
    },
  })

  if (totalQuestions === 0) return 0

  const answeredQuestions = await prisma.userAnswer.groupBy({
    by: ["questionId"],
    where: {
      userId,
      question: {
        topic: {
          chapter: {
            moduleId: { in: moduleIds },
          },
        },
      },
    },
  })

  return Math.min(
    100,
    Math.round((answeredQuestions.length / totalQuestions) * 100)
  )
}

async function getCurrentStreakDays(userId: string) {
  const user = await recordDailyVisit(userId)
  return user?.streakDays ?? 0
}

async function getTopicUpNext(userId: string): Promise<TopicUpNext | null> {
  const candidates = await prisma.$queryRaw<TopicUpNext[]>`
    SELECT
      t."id",
      t."title",
      m."id" AS "moduleId",
      m."title" AS "moduleTitle",
      c."title" AS "chapterTitle",
      COUNT(DISTINCT q."id")::int AS "totalQuestions",
      COUNT(DISTINCT ua."questionId")::int AS "answered"
    FROM "module_enrollments" me
    INNER JOIN "modules" m ON m."id" = me."moduleId"
    INNER JOIN "chapters" c ON c."moduleId" = m."id"
    INNER JOIN "topics" t ON t."chapterId" = c."id"
    LEFT JOIN "questions" q ON q."topicId" = t."id"
    LEFT JOIN "user_answers" ua ON ua."questionId" = q."id" AND ua."userId" = ${userId}
    WHERE me."userId" = ${userId}
    GROUP BY me."enrolledAt", m."id", m."title", c."id", c."title", c."order", t."id", t."title", t."order"
    ORDER BY me."enrolledAt" ASC, c."order" ASC, t."order" ASC
  `

  return (
    candidates.find((topic) => {
      if (topic.totalQuestions === 0) return false
      const completeAt = Math.floor(topic.totalQuestions * TOPIC_COMPLETION_THRESHOLD)
      return topic.answered > 0 && topic.answered < completeAt
    }) ??
    candidates.find((topic) => topic.totalQuestions > 0 && topic.answered === 0) ??
    candidates[0] ??
    null
  )
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

  const [studyProgressPercent, currentStreakDays, topicUpNext, timetable] = await Promise.all([
    getStudyProgressPercent(userId),
    getCurrentStreakDays(userId),
    getTopicUpNext(userId),
    getTimetableSummary(userId),
  ])

  return (
    // The one page that keeps a grey background and real cards (globals.css)
    <div data-page-bg="grey" data-keep-cards>
      <Header
        title="Dashboard"
        subtitle="Your study overview for today"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardWidget
          title="Study Progress"
          description="Overall completion across modules"
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

        <DashboardWidget
          title="Topic Up Next"
          description="Continue where you left off"
          delay={0.1}
        >
          {topicUpNext ? (
            <Link
              href={`/modules/${topicUpNext.moduleId}/topics/${topicUpNext.id}`}
              className="group flex items-start justify-between gap-3"
            >
              <div className="flex min-w-0 items-start gap-3">
                <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{topicUpNext.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {topicUpNext.moduleTitle} / {topicUpNext.chapterTitle}
                  </p>
                  {topicUpNext.totalQuestions > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {topicUpNext.answered}/{topicUpNext.totalQuestions} questions answered
                    </p>
                  )}
                </div>
              </div>
              <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <div className="flex items-start gap-3">
              <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">
                No topics scheduled yet. Enroll in a module to get started.
              </p>
            </div>
          )}
        </DashboardWidget>

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
              {timetable.today.slice(0, 4).map(e => (
                <li key={e.id}>
                  <Link href="/timetable" className="flex items-center gap-3 rounded-2xl bg-muted px-3 py-2 hover:bg-tint-blue">
                    <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{e.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {timeLabel(e)}{e.moduleTitle && ` · ${e.moduleTitle}`}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
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
