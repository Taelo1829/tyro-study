import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-session"
import { plannerEventDisabled } from "@/lib/weekly-planner-settings"
import {
  deleteCalendarEvent,
  getCalendarEventOwner,
  setCalendarEventCompleted,
} from "@/lib/calendar"

type Params = { params: Promise<{ id: string }> }

async function ownEventOr404(id: string, userId: string) {
  const owner = await getCalendarEventOwner(id)
  return owner === userId
}

// PATCH /api/calendar/:id { completed } - tick an entry off
export async function PATCH(request: Request, { params }: Params) {
  const { error, userId } = await requireAuth()
  if (error) return error

  const { id } = await params
  if (!(await ownEventOr404(id, userId!))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { completed } = (await request.json().catch(() => ({}))) as { completed?: boolean }
  if (await plannerEventDisabled(id)) return NextResponse.json({ error: "The weekly planner is turned off for this module." }, { status: 403 })
  if (typeof completed !== "boolean") {
    return NextResponse.json({ error: "completed must be true or false" }, { status: 400 })
  }

  await setCalendarEventCompleted(id, completed)
  return NextResponse.json({ success: true })
}

// DELETE /api/calendar/:id
export async function DELETE(_request: Request, { params }: Params) {
  const { error, userId } = await requireAuth()
  if (error) return error

  const { id } = await params
  if (!(await ownEventOr404(id, userId!))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await deleteCalendarEvent(id)
  return NextResponse.json({ success: true })
}
