import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-session"
import { FEEDBACK_MAX, FEEDBACK_MIN, createFeedback, isFeedbackKind } from "@/lib/feedback"
import { hit, limitKey } from "@/lib/rate-limit"
import { routeTemplate } from "@/lib/route-template"
import { track } from "@/lib/analytics"
import { captureError } from "@/lib/monitoring"

const PER_USER = { limit: 5, windowSeconds: 3600 }

/** POST { kind, message, page? } from the feedback form. Signed-in students only; 5 per hour. */
export async function POST(request: Request) {
  const { error, userId } = await requireAuth()
  if (error) return error
  const body = (await request.json().catch(() => null)) as { kind?: unknown; message?: unknown; page?: unknown } | null
  const message = typeof body?.message === "string" ? body.message.trim() : ""
  if (!body || !isFeedbackKind(body.kind)) return NextResponse.json({ error: "Choose what kind of feedback this is" }, { status: 400 })
  if (message.length < FEEDBACK_MIN) return NextResponse.json({ error: "Tell us a little more" }, { status: 400 })
  if (message.length > FEEDBACK_MAX) return NextResponse.json({ error: `Keep it under ${FEEDBACK_MAX} characters` }, { status: 400 })

  if ((await hit(limitKey("feedback", userId), PER_USER)) > PER_USER.limit) {
    return NextResponse.json({ error: "Thanks! You've sent a lot of feedback this hour. Try again later." }, { status: 429 })
  }
  const page = typeof body.page === "string" && body.page.startsWith("/") ? routeTemplate(body.page) : null
  try {
    await createFeedback({ userId, kind: body.kind, message, page })
  } catch (err) {
    captureError("Feedback save error", err, "/api/feedback")
    return NextResponse.json({ error: "Couldn't send that. Please try again." }, { status: 503 })
  }
  track("feedback_sent", { userId, props: { kind: body.kind, page } })
  return NextResponse.json({ ok: true }, { status: 201 })
}
