import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import { deliverPush, pushConfigProblem } from "@/lib/web-push"

/**
 * GET /api/push/test - for checking notifications while signed in.
 * Sends a test notification to each of your devices and shows your recent
 * and upcoming timetable reminders, so you can see whether a reminder was
 * scheduled, whether it went out, and what the push service said.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  const { error, userId } = await requireAuth()
  if (error) return error

  const configProblem = pushConfigProblem()
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: userId! },
    select: { id: true, endpoint: true, p256dh: true, auth: true, createdAt: true },
  })

  const devices = await Promise.all(
    subscriptions.map(async s => {
      const result = await deliverPush(s, {
        title: "Test notification",
        body: "If you can see this, notifications reach this device.",
        url: "/timetable",
        tag: "push-test",
      })
      return {
        service: new URL(s.endpoint).hostname,
        registered: s.createdAt,
        delivered: result.ok,
        status: result.status,
        detail: result.detail,
      }
    })
  )

  // Reminders from the last day and the next week
  const reminders = await prisma.$queryRaw<
    { title: string; type: string; completed: boolean; startAt: string; remindAt: string | null; remindedAt: string | null }[]
  >`
    SELECT "title", "type", "completed",
      to_char("startAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "startAt",
      to_char("remindAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "remindAt",
      to_char("remindedAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "remindedAt"
    FROM "calendar_events"
    WHERE "userId" = ${userId}
      AND "startAt" > (NOW() AT TIME ZONE 'UTC') - INTERVAL '1 day'
      AND "startAt" < (NOW() AT TIME ZONE 'UTC') + INTERVAL '7 days'
    ORDER BY "startAt"
    LIMIT 20
  `

  const now = Date.now()
  return NextResponse.json({
    serverTimeUtc: new Date(now).toISOString(),
    serverTimeSouthAfrica: new Date(now).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }),
    pushSettings: configProblem ?? "OK",
    cronSecretSet: !!process.env.CRON_SECRET,
    devices: devices.length ? devices : "No devices registered. Tap the bell in the top bar to turn notifications on.",
    reminders: reminders.map(r => ({
      title: r.title,
      type: r.type,
      startsSouthAfrica: new Date(r.startAt).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }),
      remindAtSouthAfrica: r.remindAt ? new Date(r.remindAt).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }) : null,
      status: r.completed
        ? "completed (no reminder sent)"
        : !r.remindAt
          ? "NO REMINDER SET on this entry"
          : r.remindedAt
            ? `sent at ${new Date(r.remindedAt).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}`
            : new Date(r.remindAt).getTime() > now
              ? "waiting (reminder time not reached yet)"
              : new Date(r.remindAt).getTime() < now - 2 * 3_600_000
                ? "missed (the scheduled check did not run within 2 hours)"
                : "DUE NOW but not sent yet: the scheduled check (cron-job.org) has not run since",
    })),
  })
}
