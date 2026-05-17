import { Header } from "@/components/layout/header"
import { DashboardWidget } from "@/components/dashboard/dashboard-widget"
import { StudyProgressDonut } from "@/components/dashboard/study-progress-donut"
import { Flame, BookOpen, Calendar, ClipboardList, ChevronRight } from "lucide-react"
import { getAuthUserId } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import { recordDailyVisit } from "@/lib/streak"
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

async function getStudyProgressPercent() {
  const userId = await getAuthUserId()
  if (!userId) return 0

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

async function getCurrentStreakDays() {
  const userId = await getAuthUserId()
  if (!userId) return 0

  const user = await recordDailyVisit(userId)
  return user?.streakDays ?? 0
}

async function getTopicUpNext(): Promise<TopicUpNext | null> {
  const userId = await getAuthUserId()
  if (!userId) return null

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

export default async function DashboardPage() {
  const [studyProgressPercent, currentStreakDays, topicUpNext] = await Promise.all([
    getStudyProgressPercent(),
    getCurrentStreakDays(),
    getTopicUpNext(),
  ])

  return (
    <>
      <Header
        title="Dashboard"
        subtitle="Your study overview for today"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardWidget
          title="Study Progress"
          description="Overall completion across modules"
          delay={0}
        >
          <StudyProgressDonut percent={studyProgressPercent} />
        </DashboardWidget>

        <DashboardWidget
          title="Current Streak"
          description="Consecutive study days"
          delay={0.05}
        >
          <div className="flex items-center gap-4">
            <div className="neo-pressed flex h-14 w-14 items-center justify-center rounded-full">
              <Flame className="h-7 w-7 text-accent" />
            </div>
            <div>
              <p className="text-3xl font-bold">{currentStreakDays}</p>
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
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              No sessions planned for today.
            </p>
          </div>
        </DashboardWidget>

        <DashboardWidget
          title="Upcoming Assignments"
          description="Due soon"
          delay={0.2}
        >
          <div className="flex items-start gap-3">
            <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              No assignments due. Add one from the Timetable.
            </p>
          </div>
        </DashboardWidget>
      </div>
    </>
  )
}
