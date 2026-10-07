import { prisma } from "@/lib/prisma"

export const CALENDAR_EVENT_TYPES = ["STUDY_SESSION", "ASSIGNMENT", "EXAM", "REMINDER"] as const
export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number]

export interface CalendarEventRow {
  id: string
  type: CalendarEventType
  title: string
  notes: string | null
  /** ISO 8601 UTC string, e.g. "2026-10-05T07:00:00.000Z" */
  startAt: string
  endAt: string | null
  allDay: boolean
  completed: boolean
  moduleId: string | null
  moduleTitle: string | null
}

/*
 * Times are stored the way Prisma stores DateTime: UTC wall-clock in a
 * TIMESTAMP (no time zone) column. These queries are raw SQL (like the
 * topic PDF queries) so they work without regenerating the Prisma client.
 * Incoming ISO strings are converted with `::timestamptz AT TIME ZONE 'UTC'`,
 * and values are read back as ISO strings formatted in SQL. Returning
 * timestamptz values instead was misread by the pg driver whenever the
 * database session wasn't in UTC (times came back hours off), so results
 * never depend on the database's time-zone setting.
 */
export function listCalendarEvents(userId: string, fromIso: string, toIso: string) {
  return prisma.$queryRaw<CalendarEventRow[]>`
    SELECT
      e."id", e."type", e."title", e."notes",
      to_char(e."startAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "startAt",
      to_char(e."endAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "endAt",
      e."allDay", e."completed", e."moduleId",
      m."title" AS "moduleTitle"
    FROM "calendar_events" e
    LEFT JOIN "modules" m ON m."id" = e."moduleId"
    WHERE e."userId" = ${userId}
      AND e."startAt" >= (${fromIso}::timestamptz AT TIME ZONE 'UTC')
      AND e."startAt" <  (${toIso}::timestamptz AT TIME ZONE 'UTC')
    ORDER BY e."startAt" ASC
  `
}

export async function getCalendarEventOwner(id: string) {
  const rows = await prisma.$queryRaw<{ userId: string }[]>`
    SELECT "userId" FROM "calendar_events" WHERE "id" = ${id} LIMIT 1
  `
  return rows[0]?.userId ?? null
}

export interface NewCalendarEvent {
  id: string
  userId: string
  moduleId: string | null
  type: CalendarEventType
  title: string
  notes: string | null
  startIso: string
  endIso: string | null
  allDay: boolean
  /** When to send a reminder notification (null = none) */
  remindIso: string | null
}

export function insertCalendarEvent(e: NewCalendarEvent) {
  return prisma.$executeRaw`
    INSERT INTO "calendar_events"
      ("id", "userId", "moduleId", "type", "title", "notes", "startAt", "endAt", "allDay", "remindAt")
    VALUES (
      ${e.id}, ${e.userId}, ${e.moduleId}, ${e.type}, ${e.title}, ${e.notes},
      (${e.startIso}::timestamptz AT TIME ZONE 'UTC'),
      ${e.endIso === null ? null : e.endIso}::timestamptz AT TIME ZONE 'UTC',
      ${e.allDay},
      ${e.remindIso === null ? null : e.remindIso}::timestamptz AT TIME ZONE 'UTC'
    )
  `
}

export function setCalendarEventCompleted(id: string, completed: boolean) {
  return prisma.$executeRaw`
    UPDATE "calendar_events"
    SET "completed" = ${completed}, "updatedAt" = (NOW() AT TIME ZONE 'UTC')
    WHERE "id" = ${id}
  `
}

export function deleteCalendarEvent(id: string) {
  return prisma.$executeRaw`DELETE FROM "calendar_events" WHERE "id" = ${id}`
}
