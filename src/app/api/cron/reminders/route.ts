import { NextResponse } from "next/server"
import { sendDueReminders } from "@/lib/reminders"

/**
 * Sends calendar reminders that have come due. Call it every few minutes
 * (e.g. every 5 minutes from cron-job.org, or a Vercel cron on the Pro plan).
 *
 * Protected by CRON_SECRET, given either as a header
 *   Authorization: Bearer <CRON_SECRET>      (what Vercel Cron sends)
 * or in the address: /api/cron/reminders?key=<CRON_SECRET>
 */
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 })
  }
  const header = request.headers.get("authorization")
  const key = new URL(request.url).searchParams.get("key")
  if (header !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await sendDueReminders()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("Reminder run failed:", error)
    return NextResponse.json({ error: "Reminder run failed" }, { status: 500 })
  }
}
