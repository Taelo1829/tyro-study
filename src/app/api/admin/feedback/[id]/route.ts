import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { isFeedbackStatus, updateFeedback } from "@/lib/feedback"

/** PATCH { status?, adminNote? }: triage feedback (Admin → Feedback). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error
  const { id } = await params
  const body = (await request.json().catch(() => null)) as { status?: unknown; adminNote?: unknown } | null
  if (!body) return NextResponse.json({ error: "Send a JSON body" }, { status: 400 })
  if (body.status !== undefined && !isFeedbackStatus(body.status)) return NextResponse.json({ error: "Unknown status" }, { status: 400 })
  const note = body.adminNote === undefined ? undefined : typeof body.adminNote === "string" ? body.adminNote.trim().slice(0, 1000) || null : null
  const ok = await updateFeedback(id, { status: body.status as never, adminNote: note })
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 })
}
