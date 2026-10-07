import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import {
  CALENDAR_EVENT_TYPES,
  insertCalendarEvent,
  listCalendarEvents,
  type CalendarEventType,
} from "@/lib/calendar"

const MAX_RANGE_DAYS = 120
const MAX_REPEAT_WEEKS = 16

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime())
}

/** A repeat's reminder, shifted by `offsetMs`; none if that time has already passed */
function reminderFor(remind: Date | null, offsetMs: number) {
  if (!remind) return null
  const at = new Date(remind.getTime() + offsetMs)
  return at.getTime() < Date.now() - 60_000 ? null : at.toISOString()
}

// GET /api/calendar?from=ISO&to=ISO - the signed-in user's events in that range
export async function GET(request: Request) {
  const { error, userId } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  if (!isValidDate(from) || !isValidDate(to)) {
    return NextResponse.json({ error: "from and to must be valid dates" }, { status: 400 })
  }
  const span = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000
  if (span <= 0 || span > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `Range must be 1–${MAX_RANGE_DAYS} days` }, { status: 400 })
  }

  const events = await listCalendarEvents(userId!, new Date(from).toISOString(), new Date(to).toISOString())
  return NextResponse.json(events)
}

// POST /api/calendar - add an event (optionally repeating weekly)
export async function POST(request: Request) {
  const { error, userId } = await requireAuth()
  if (error) return error

  const body = (await request.json().catch(() => ({}))) as {
    type?: string
    title?: string
    notes?: string
    moduleId?: string
    startAt?: string
    endAt?: string | null
    allDay?: boolean
    repeatWeeks?: number
    /** When to send a reminder (worked out in the browser, in its time zone); null = none */
    remindAt?: string | null
  }

  const type = body.type as CalendarEventType
  if (!CALENDAR_EVENT_TYPES.includes(type)) {
    return NextResponse.json({ error: "Choose what kind of entry this is" }, { status: 400 })
  }
  const title = body.title?.trim()
  if (!title) return NextResponse.json({ error: "Give it a title" }, { status: 400 })
  if (title.length > 200) return NextResponse.json({ error: "Title is too long" }, { status: 400 })
  if (!isValidDate(body.startAt)) return NextResponse.json({ error: "Pick a valid date and time" }, { status: 400 })

  const start = new Date(body.startAt)
  let end: Date | null = null
  if (body.endAt) {
    if (!isValidDate(body.endAt)) return NextResponse.json({ error: "End time is invalid" }, { status: 400 })
    end = new Date(body.endAt)
    if (end <= start) return NextResponse.json({ error: "End time must be after the start time" }, { status: 400 })
  }

  // A module is optional, but if given the user must be enrolled in it
  let moduleId: string | null = null
  if (body.moduleId) {
    const enrolled = await prisma.moduleEnrollment.findUnique({
      where: { userId_moduleId: { userId: userId!, moduleId: body.moduleId } },
      select: { id: true },
    })
    if (!enrolled) return NextResponse.json({ error: "You are not enrolled in that module" }, { status: 403 })
    moduleId = body.moduleId
  }

  // Reminder: no later than the event itself, and no more than a week before it
  let remind: Date | null = null
  if (body.remindAt) {
    if (!isValidDate(body.remindAt)) return NextResponse.json({ error: "Reminder time is invalid" }, { status: 400 })
    remind = new Date(body.remindAt)
    const lead = start.getTime() - remind.getTime()
    if (lead < -12 * 3_600_000 || lead > 7 * 86_400_000) {
      return NextResponse.json({ error: "Reminders can be set up to a week before" }, { status: 400 })
    }
  }

  const repeatWeeks = Math.min(MAX_REPEAT_WEEKS, Math.max(1, Math.floor(Number(body.repeatWeeks) || 1)))
  const weekMs = 7 * 86_400_000
  const notes = body.notes?.trim() || null

  for (let i = 0; i < repeatWeeks; i++) {
    await insertCalendarEvent({
      id: randomUUID(),
      userId: userId!,
      moduleId,
      type,
      title,
      notes,
      startIso: new Date(start.getTime() + i * weekMs).toISOString(),
      endIso: end ? new Date(end.getTime() + i * weekMs).toISOString() : null,
      allDay: !!body.allDay,
      remindIso: reminderFor(remind, i * weekMs),
    })
  }

  return NextResponse.json({ success: true, created: repeatWeeks }, { status: 201 })
}
