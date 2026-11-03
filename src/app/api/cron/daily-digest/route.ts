import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/email"
import { CONTACT_EMAIL, siteUrl } from "@/lib/site"
import { digestText, opsReport } from "@/lib/ops-report"
import { heartbeat, pruneErrorGroups } from "@/lib/monitoring"
import { pruneRateLimits } from "@/lib/rate-limit"
import { log } from "@/lib/log"

/**
 * Daily ops email to OPS_EMAIL (comma-separated; default: the site contact):
 * new and repeating errors, scheduled jobs that stopped, activity, real-user
 * performance. Scheduled in vercel.json (Hobby: once a day, within the hour).
 *
 * Protected by CRON_SECRET (Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`).
 * Add ?dry=1 to get the text back without sending.
 * Also housekeeping: expired rate-limit windows and error groups not seen for 90 days.
 */
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 })
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const report = await opsReport()
    const { subject, text, needsAttention } = digestText(report, siteUrl())
    if (new URL(request.url).searchParams.get("dry") === "1") {
      return NextResponse.json({ ok: true, subject, text, needsAttention })
    }
    const [prunedLimits, prunedErrors] = await Promise.all([pruneRateLimits(), pruneErrorGroups(90)])
    const recipients = (process.env.OPS_EMAIL || CONTACT_EMAIL).split(",").map(s => s.trim()).filter(Boolean)
    for (const to of recipients) await sendEmail({ to, subject, text })
    await heartbeat("cron:daily-digest", { ok: true, details: { needsAttention, recipients: recipients.length, prunedLimits, prunedErrors } })
    log.info("cron.daily_digest", { needsAttention, recipients: recipients.length })
    return NextResponse.json({ ok: true, needsAttention })
  } catch (error) {
    await heartbeat("cron:daily-digest", { ok: false, error })
    log.error("cron.daily_digest.failed", { err: error })
    return NextResponse.json({ error: "Digest failed" }, { status: 500 })
  }
}
