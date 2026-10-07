import { prisma } from "@/lib/prisma"
import { sendPushToUser, type PushMessage } from "@/lib/web-push"
import type { CalendarEventType } from "@/lib/calendar"

/**
 * Calendar reminders. Each event can have a remindAt time (worked out in the
 * student's browser, so it's right for their time zone). /api/cron/reminders
 * runs every few minutes and calls sendDueReminders(), which sends a push
 * notification for every reminder that has come due, once.
 */

/** Reminders more than this late (e.g. the scheduler was down) are skipped, not sent hours late */
const MAX_LATE_MINUTES = 120
const BATCH = 500

interface DueReminder {
  id: string
  userId: string
  type: CalendarEventType
  title: string
  allDay: boolean
  moduleId: string | null
  startAt: string
  remindAt: string
}

const LABELS: Record<CalendarEventType, string> = {
  STUDY_SESSION: "Study session",
  ASSIGNMENT: "Assignment due",
  EXAM: "Exam",
  REMINDER: "Reminder",
}

/** "in 15 minutes", "in 1 hour", "tomorrow"… from how far ahead the reminder was set */
export function timeUntil(minutes: number): string {
  if (minutes <= 1) return "now"
  if (minutes < 60) return `in ${minutes} minutes`
  const hours = Math.round(minutes / 60)
  if (minutes < 20 * 60) return hours === 1 ? "in 1 hour" : `in ${hours} hours`
  const days = Math.round(minutes / (24 * 60))
  return days <= 1 ? "tomorrow" : `in ${days} days`
}

/** The notification text for one event */
export function reminderMessage(e: { id: string; type: CalendarEventType; title: string; allDay: boolean; startAt: string; remindAt: string }, moduleTitle: string | null): PushMessage {
  const lead = Math.round((new Date(e.startAt).getTime() - new Date(e.remindAt).getTime()) / 60_000)
  let when: string
  if (e.allDay) {
    // All-day events start at local midnight; a reminder before that is "tomorrow"
    when = lead > 0 ? "tomorrow" : "today"
  } else {
    when = timeUntil(lead)
  }

  const label = LABELS[e.type] ?? "Reminder"
  let title: string
  switch (e.type) {
    case "ASSIGNMENT":
      title = when === "now" ? `${e.title} is due now` : `${e.title} is due ${when}`
      break
    case "EXAM":
      title = when === "now" ? `${e.title} starts now` : `${e.title} ${when === "today" || when === "tomorrow" ? "is" : "starts"} ${when}`
      break
    case "STUDY_SESSION":
      title = when === "now" ? `Time to study: ${e.title}` : `Study session ${when}: ${e.title}`
      break
    default:
      title = e.title
  }

  const body = [e.type === "REMINDER" && when !== "now" ? `${label} ${when}` : label, moduleTitle].filter(Boolean).join(" · ")
  return { title, body, url: "/timetable", tag: `event-${e.id}` }
}

/**
 * Send every reminder that has come due. Each event is claimed (remindedAt
 * set) in the same statement that finds it, so two overlapping runs can never
 * send the same reminder twice.
 */
export async function sendDueReminders(): Promise<{ due: number; sent: number }> {
  const due = await prisma.$queryRaw<DueReminder[]>`
    UPDATE "calendar_events" e
    SET "remindedAt" = (NOW() AT TIME ZONE 'UTC')
    WHERE e."id" IN (
      SELECT "id" FROM "calendar_events"
      WHERE "remindedAt" IS NULL
        AND "remindAt" IS NOT NULL
        AND "completed" = false
        AND "remindAt" <= (NOW() AT TIME ZONE 'UTC')
        AND "remindAt" > (NOW() AT TIME ZONE 'UTC') - make_interval(mins => ${MAX_LATE_MINUTES}::int)
      ORDER BY "remindAt"
      LIMIT ${BATCH}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING
      e."id", e."userId", e."type", e."title", e."allDay", e."moduleId",
      to_char(e."startAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "startAt",
      to_char(e."remindAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "remindAt"
  `
  if (due.length === 0) return { due: 0, sent: 0 }

  const moduleIds = [...new Set(due.map(d => d.moduleId).filter((id): id is string => !!id))]
  const modules = moduleIds.length
    ? await prisma.module.findMany({ where: { id: { in: moduleIds } }, select: { id: true, title: true } })
    : []
  const moduleTitle = new Map(modules.map(m => [m.id, m.title]))

  let sent = 0
  await Promise.allSettled(
    due.map(async d => {
      sent += await sendPushToUser(d.userId, reminderMessage(d, d.moduleId ? moduleTitle.get(d.moduleId) ?? null : null))
    })
  )
  return { due: due.length, sent }
}
