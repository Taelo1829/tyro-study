import { Prisma } from "@/prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * The numbers behind the admin analytics page (/admin/analytics), worked out
 * from the "analytics_events" table. Admins' own activity is left out.
 *
 * Times are stored in UTC; days and weeks are counted in South African time.
 * Metric definitions follow business/01-discovery-and-business-analysis.md.
 */

/** Events that count as studying (not just visiting) */
const LEARNING_EVENTS = Prisma.sql`('lesson_opened', 'quiz_completed')`

/** Every event except those by admins */
const EV = Prisma.sql`
  ev AS (
    SELECT e.* FROM "analytics_events" e
    LEFT JOIN "users" u ON u."id" = e."userId"
    WHERE u."role" IS NULL OR u."role" <> 'ADMIN'
  )`

/** The current time as UTC without a time zone, like the stored "createdAt" */
const NOW = Prisma.sql`(NOW() AT TIME ZONE 'UTC')`

/** A stored UTC time as South African local time / date */
const local = (col: string) => Prisma.raw(`((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Johannesburg')`)
const localDate = (col: string) => Prisma.raw(`DATE((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Johannesburg')`)
const TODAY = Prisma.sql`DATE(NOW() AT TIME ZONE 'Africa/Johannesburg')`

export const RANGES = [7, 30, 90] as const
export type RangeDays = (typeof RANGES)[number]

export function asRange(value: unknown): RangeDays {
  const n = Number(value)
  return (RANGES as readonly number[]).includes(n) ? (n as RangeDays) : 30
}

export interface Overview {
  visitors: number
  pageViews: number
  signUpsStarted: number
  signUps: number
  activeUsers: number
  weeklyActiveLearners: number
  firstEventAt: Date | null
}

export interface Cohort {
  signUps: number
  activationEligible: number
  activated: number
  d1Eligible: number
  d1Returned: number
  d7Eligible: number
  d7Returned: number
  joinedModule: number
  openedLesson: number
  startedQuiz: number
  passedQuiz: number
}

export interface WeekRow {
  week: string
  activeLearners: number
  signUps: number
  quizzesPassed: number
}

export interface QuizRow {
  kind: string
  started: number
  completed: number
  passed: number
  avgScore: number | null
}

export interface PageRow {
  page: string
  views: number
  visitors: number
}

export interface SourceRow {
  source: string
  visits: number
  visitors: number
}

export interface CountRow {
  name: string
  count: number
  users: number
}

export interface AnalyticsReport {
  days: RangeDays
  overview: Overview
  cohort: Cohort
  weeks: WeekRow[]
  quizzes: QuizRow[]
  pages: PageRow[]
  sources: SourceRow[]
  events: CountRow[]
  tabs: CountRow[]
}

export async function getAnalyticsReport(days: RangeDays): Promise<AnalyticsReport> {
  const since = Prisma.sql`(${NOW} - make_interval(days => ${days}::int))`

  const [overview, cohort, weeks, quizzes, pages, sources, events, tabs] = await Promise.all([
    prisma.$queryRaw<Overview[]>`
      WITH ${EV}
      SELECT
        COUNT(DISTINCT COALESCE("anonId", "userId")) FILTER (WHERE "name" = 'page_view' AND "createdAt" >= ${since})::int AS "visitors",
        COUNT(*) FILTER (WHERE "name" = 'page_view' AND "createdAt" >= ${since})::int AS "pageViews",
        COUNT(*) FILTER (WHERE "name" = 'sign_up_started' AND "createdAt" >= ${since})::int AS "signUpsStarted",
        COUNT(*) FILTER (WHERE "name" = 'sign_up' AND "createdAt" >= ${since})::int AS "signUps",
        COUNT(DISTINCT "userId") FILTER (WHERE "createdAt" >= ${since})::int AS "activeUsers",
        COUNT(DISTINCT "userId") FILTER (WHERE "name" IN ${LEARNING_EVENTS} AND "createdAt" >= ${NOW} - INTERVAL '7 days')::int AS "weeklyActiveLearners",
        MIN("createdAt") AS "firstEventAt"
      FROM ev`,

    // Students who signed up in the range, and what they did afterwards
    prisma.$queryRaw<Cohort[]>`
      WITH ${EV},
      cohort AS (
        SELECT "userId", MIN("createdAt") AS "at"
        FROM ev
        WHERE "name" = 'sign_up' AND "userId" IS NOT NULL AND "createdAt" >= ${since}
        GROUP BY "userId"
      ),
      did AS (
        SELECT
          c."userId",
          c."at",
          ${localDate('c."at"')} AS "day",
          EXISTS (SELECT 1 FROM ev e WHERE e."userId" = c."userId" AND e."name" = 'quiz_completed' AND e."props"->>'passed' = 'true'
                  AND e."createdAt" BETWEEN c."at" AND c."at" + INTERVAL '24 hours') AS "activated",
          EXISTS (SELECT 1 FROM ev e WHERE e."userId" = c."userId" AND ${localDate('e."createdAt"')} = ${localDate('c."at"')} + 1) AS "d1",
          EXISTS (SELECT 1 FROM ev e WHERE e."userId" = c."userId"
                  AND ${localDate('e."createdAt"')} BETWEEN ${localDate('c."at"')} + 1 AND ${localDate('c."at"')} + 7) AS "d7",
          EXISTS (SELECT 1 FROM ev e WHERE e."userId" = c."userId" AND e."name" = 'module_joined') AS "joined",
          EXISTS (SELECT 1 FROM ev e WHERE e."userId" = c."userId" AND e."name" = 'lesson_opened') AS "lesson",
          EXISTS (SELECT 1 FROM ev e WHERE e."userId" = c."userId" AND e."name" = 'quiz_started') AS "started",
          EXISTS (SELECT 1 FROM ev e WHERE e."userId" = c."userId" AND e."name" = 'quiz_completed' AND e."props"->>'passed' = 'true') AS "passed"
        FROM cohort c
      )
      SELECT
        COUNT(*)::int AS "signUps",
        COUNT(*) FILTER (WHERE "at" <= ${NOW} - INTERVAL '24 hours')::int AS "activationEligible",
        COUNT(*) FILTER (WHERE "at" <= ${NOW} - INTERVAL '24 hours' AND "activated")::int AS "activated",
        COUNT(*) FILTER (WHERE "day" <= ${TODAY} - 1)::int AS "d1Eligible",
        COUNT(*) FILTER (WHERE "day" <= ${TODAY} - 1 AND "d1")::int AS "d1Returned",
        COUNT(*) FILTER (WHERE "day" <= ${TODAY} - 7)::int AS "d7Eligible",
        COUNT(*) FILTER (WHERE "day" <= ${TODAY} - 7 AND "d7")::int AS "d7Returned",
        COUNT(*) FILTER (WHERE "joined")::int AS "joinedModule",
        COUNT(*) FILTER (WHERE "lesson")::int AS "openedLesson",
        COUNT(*) FILTER (WHERE "started")::int AS "startedQuiz",
        COUNT(*) FILTER (WHERE "passed")::int AS "passedQuiz"
      FROM did`,

    // The last 8 weeks (Monday to Sunday), oldest first
    prisma.$queryRaw<WeekRow[]>`
      WITH ${EV},
      local_ev AS (SELECT "name", "userId", "props", ${local('"createdAt"')} AS "t" FROM ev),
      weeks AS (
        SELECT generate_series(
          date_trunc('week', NOW() AT TIME ZONE 'Africa/Johannesburg') - INTERVAL '7 weeks',
          date_trunc('week', NOW() AT TIME ZONE 'Africa/Johannesburg'),
          INTERVAL '1 week'
        ) AS "wk"
      )
      SELECT
        to_char(w."wk", 'YYYY-MM-DD') AS "week",
        (SELECT COUNT(DISTINCT e."userId") FROM local_ev e
          WHERE e."name" IN ${LEARNING_EVENTS} AND e."t" >= w."wk" AND e."t" < w."wk" + INTERVAL '1 week')::int AS "activeLearners",
        (SELECT COUNT(*) FROM local_ev e
          WHERE e."name" = 'sign_up' AND e."t" >= w."wk" AND e."t" < w."wk" + INTERVAL '1 week')::int AS "signUps",
        (SELECT COUNT(*) FROM local_ev e
          WHERE e."name" = 'quiz_completed' AND e."props"->>'passed' = 'true' AND e."t" >= w."wk" AND e."t" < w."wk" + INTERVAL '1 week')::int AS "quizzesPassed"
      FROM weeks w
      ORDER BY w."wk"`,

    prisma.$queryRaw<QuizRow[]>`
      WITH ${EV}
      SELECT
        COALESCE("props"->>'kind', 'unknown') AS "kind",
        COUNT(*) FILTER (WHERE "name" = 'quiz_started')::int AS "started",
        COUNT(*) FILTER (WHERE "name" = 'quiz_completed')::int AS "completed",
        COUNT(*) FILTER (WHERE "name" = 'quiz_completed' AND "props"->>'passed' = 'true')::int AS "passed",
        ROUND(AVG(("props"->>'score')::numeric) FILTER (WHERE "name" = 'quiz_completed'))::int AS "avgScore"
      FROM ev
      WHERE "name" IN ('quiz_started', 'quiz_completed') AND "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY "started" DESC`,

    // Ids in paths (/modules/clx…/topics/clx…) are folded into ":id"
    prisma.$queryRaw<PageRow[]>`
      WITH ${EV}
      SELECT
        regexp_replace("path", '/[A-Za-z0-9_-]{20,}', '/:id', 'g') AS "page",
        COUNT(*)::int AS "views",
        COUNT(DISTINCT COALESCE("anonId", "userId"))::int AS "visitors"
      FROM ev
      WHERE "name" = 'page_view' AND "path" IS NOT NULL AND "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY "views" DESC
      LIMIT 15`,

    // Where visits start: utm_source if given, else the referring site
    prisma.$queryRaw<SourceRow[]>`
      WITH ${EV}
      SELECT
        COALESCE("props"->>'utm_source', "props"->>'referrer', 'Direct or app') AS "source",
        COUNT(*)::int AS "visits",
        COUNT(DISTINCT COALESCE("anonId", "userId"))::int AS "visitors"
      FROM ev
      WHERE "name" = 'page_view' AND "props"->>'entry' = 'true' AND "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY "visits" DESC
      LIMIT 10`,

    prisma.$queryRaw<CountRow[]>`
      WITH ${EV}
      SELECT "name", COUNT(*)::int AS "count", COUNT(DISTINCT "userId")::int AS "users"
      FROM ev
      WHERE "createdAt" >= ${since}
      GROUP BY "name"
      ORDER BY "count" DESC`,

    prisma.$queryRaw<CountRow[]>`
      WITH ${EV}
      SELECT COALESCE("props"->>'tab', 'unknown') AS "name", COUNT(*)::int AS "count", COUNT(DISTINCT "userId")::int AS "users"
      FROM ev
      WHERE "name" = 'topic_tab_viewed' AND "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY "count" DESC`,
  ])

  return {
    days,
    overview: overview[0],
    cohort: cohort[0],
    weeks,
    quizzes,
    pages,
    sources,
    events,
    tabs,
  }
}
