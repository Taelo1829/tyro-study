"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BookOpen,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Bell,
  Plus,
  Trash2,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Modal, ModalBody, ModalHeader } from "@/components/admin/modal"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

// ─── Types & constants ───────────────────────────────────────────────────────

type EventType = "STUDY_SESSION" | "ASSIGNMENT" | "EXAM" | "REMINDER"

interface CalendarEvent {
  id: string
  type: EventType
  title: string
  notes: string | null
  startAt: string
  endAt: string | null
  allDay: boolean
  completed: boolean
  moduleId: string | null
  moduleTitle: string | null
}

interface ModuleOption {
  id: string
  title: string
}

const TYPES: Record<EventType, {
  label: string
  short: string
  icon: typeof BookOpen
  dot: string
  chip: string
}> = {
  STUDY_SESSION: { label: "Study session", short: "Study", icon: BookOpen, dot: "bg-accent", chip: "tint-blue text-sky-900" },
  ASSIGNMENT: { label: "Assignment due", short: "Due", icon: ClipboardList, dot: "bg-orange", chip: "bg-orange-50 text-orange-800" },
  EXAM: { label: "Exam / test", short: "Exam", icon: GraduationCap, dot: "bg-red-500", chip: "bg-red-50 text-red-700" },
  REMINDER: { label: "Reminder", short: "Note", icon: Bell, dot: "bg-emerald-400", chip: "tint-mint text-emerald-900" },
}
const TYPE_ORDER: EventType[] = ["STUDY_SESSION", "ASSIGNMENT", "EXAM", "REMINDER"]
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"]

const monthFormat = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" })
const dayTitleFormat = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" })
const shortDayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" })

// ─── Date helpers (all in the browser's local time) ──────────────────────────

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}
function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function sameDay(a: Date, b: Date) {
  return dayKey(a) === dayKey(b)
}
/** 6-week grid starting on the Sunday on/before the 1st of the month */
function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = addDays(first, -first.getDay())
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}
/** Combine a local date with "HH:MM" into a Date */
function atTime(day: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h || 0, m || 0)
}
function eventTimeLabel(e: CalendarEvent) {
  if (e.allDay) return "All day"
  const start = timeFormat.format(new Date(e.startAt))
  if (e.type === "ASSIGNMENT") return `Due ${start}`
  return e.endAt ? `${start} – ${timeFormat.format(new Date(e.endAt))}` : start
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TimetablePage() {
  const today = useMemo(() => startOfDay(new Date()), [])
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [upcoming, setUpcoming] = useState<CalendarEvent[]>([])
  const [modules, setModules] = useState<ModuleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const grid = useMemo(() => monthGrid(month), [month])

  const loadMonth = useCallback(async () => {
    const from = grid[0]
    const to = addDays(grid[grid.length - 1], 1)
    const res = await fetch(`/api/calendar?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`)
    if (!res.ok) throw new Error("Could not load your timetable")
    setEvents(await res.json())
  }, [grid])

  const loadUpcoming = useCallback(async () => {
    const from = new Date()
    const to = addDays(today, 31)
    const res = await fetch(`/api/calendar?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`)
    if (res.ok) setUpcoming(await res.json())
  }, [today])

  const reload = useCallback(async () => {
    try {
      await Promise.all([loadMonth(), loadUpcoming()])
    } catch (err) {
      toast.error("Error", err instanceof Error ? err.message : "Could not load your timetable")
    } finally {
      setLoading(false)
    }
  }, [loadMonth, loadUpcoming])

  useEffect(() => {
    // Fetching on mount / month change is the intended external sync
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  useEffect(() => {
    fetch("/api/enrollments")
      .then(res => (res.ok ? res.json() : []))
      .then((data: ModuleOption[]) => setModules(data.map(m => ({ id: m.id, title: m.title }))))
      .catch(() => setModules([]))
  }, [])

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const key = dayKey(new Date(e.startAt))
      map.set(key, [...(map.get(key) ?? []), e])
    }
    return map
  }, [events])

  const upcomingOpen = upcoming.filter(e => !e.completed).slice(0, 8)

  return (
    <>
      <Header title="Timetable" subtitle="Tap a day to plan study sessions, due dates and exams" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Calendar */}
        <Card className="p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="neo-button flex h-11 w-11 items-center justify-center"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold sm:text-xl">{monthFormat.format(month)}</h2>
              {!(month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()) && (
                <button
                  type="button"
                  onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
                  className="rounded-full bg-muted px-3 py-1 text-xs font-medium hover:bg-tint-blue"
                >
                  Today
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="neo-button flex h-11 w-11 items-center justify-center"
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground sm:gap-2 sm:text-sm">
            {WEEKDAYS.map((d, i) => <div key={i} className="pb-2">{d}</div>)}
          </div>

          <div className={cn("grid grid-cols-7 gap-1 sm:gap-2", loading && "opacity-60")}>
            {grid.map(day => {
              const inMonth = day.getMonth() === month.getMonth()
              const isToday = sameDay(day, today)
              const dayEvents = byDay.get(dayKey(day)) ?? []
              const types = TYPE_ORDER.filter(t => dayEvents.some(e => e.type === t))
              return (
                <button
                  key={dayKey(day)}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  aria-label={`${dayTitleFormat.format(day)}${dayEvents.length ? `, ${dayEvents.length} item${dayEvents.length > 1 ? "s" : ""}` : ""}`}
                  className={cn(
                    "group flex min-h-14 flex-col items-center rounded-2xl p-1 transition-colors sm:min-h-24 sm:items-stretch sm:p-1.5",
                    inMonth ? "hover:bg-muted" : "opacity-40 hover:opacity-70",
                    dayEvents.length > 0 && inMonth && "bg-muted/60"
                  )}
                >
                  <span
                    className={cn(
                      "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium sm:h-9 sm:w-9",
                      isToday ? "bg-primary text-primary-foreground" : "group-hover:bg-card"
                    )}
                  >
                    {day.getDate()}
                  </span>

                  {/* Phones: coloured dots */}
                  {types.length > 0 && (
                    <span className="mt-1 flex justify-center gap-0.5 sm:hidden">
                      {types.map(t => <span key={t} className={cn("h-1.5 w-1.5 rounded-full", TYPES[t].dot)} />)}
                    </span>
                  )}

                  {/* Larger screens: up to two chips */}
                  <span className="mt-1 hidden flex-col gap-1 sm:flex">
                    {dayEvents.slice(0, 2).map(e => (
                      <span
                        key={e.id}
                        className={cn(
                          "truncate rounded-full px-2 py-0.5 text-left text-[11px] font-medium",
                          TYPES[e.type].chip,
                          e.completed && "line-through opacity-60"
                        )}
                      >
                        {e.title}
                      </span>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="px-2 text-left text-[11px] text-muted-foreground">+{dayEvents.length - 2} more</span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-4">
            {TYPE_ORDER.map(t => (
              <span key={t} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={cn("h-2.5 w-2.5 rounded-full", TYPES[t].dot)} />
                {TYPES[t].label}
              </span>
            ))}
          </div>
        </Card>

        {/* Upcoming */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-semibold">Coming up</h2>
            <Button size="sm" variant="primary" onClick={() => setSelectedDay(today)}>
              <Plus className="h-4 w-4" />
              Add for today
            </Button>
          </div>
          {upcomingOpen.length === 0 ? (
            <Card className="tint-slate flex flex-col items-center py-10 text-center shadow-none">
              <CalendarIcon className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Nothing planned for the next month</p>
              <p className="mt-1 text-xs text-muted-foreground">Tap any day on the calendar to add a study session or due date.</p>
            </Card>
          ) : (
            <ul className="space-y-3">
              {upcomingOpen.map(e => {
                const meta = TYPES[e.type]
                const Icon = meta.icon
                const start = new Date(e.startAt)
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedDay(startOfDay(start))}
                      className="neo-flat flex w-full items-center gap-3 p-4 text-left transition-transform hover:scale-[1.01]"
                    >
                      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", meta.chip)}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{e.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {sameDay(start, today) ? "Today" : shortDayFormat.format(start)} · {eventTimeLabel(e)}
                          {e.moduleTitle && ` · ${e.moduleTitle}`}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <DayModal
        day={selectedDay}
        events={selectedDay ? byDayFor(events, upcoming, selectedDay) : []}
        modules={modules}
        onClose={() => setSelectedDay(null)}
        onChanged={reload}
      />
    </>
  )
}

/** Events on a given day, from whichever list has them (month or upcoming) */
function byDayFor(monthEvents: CalendarEvent[], upcoming: CalendarEvent[], day: Date) {
  const seen = new Set<string>()
  return [...monthEvents, ...upcoming]
    .filter(e => {
      if (seen.has(e.id) || !sameDay(new Date(e.startAt), day)) return false
      seen.add(e.id)
      return true
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
}

// ─── Day pop-up ──────────────────────────────────────────────────────────────

function DayModal({
  day,
  events,
  modules,
  onClose,
  onChanged,
}: {
  day: Date | null
  events: CalendarEvent[]
  modules: ModuleOption[]
  onClose: () => void
  onChanged: () => Promise<void> | void
}) {
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const open = day !== null
  const showForm = adding || events.length === 0

  function close() {
    setAdding(false)
    onClose()
  }

  async function toggleDone(e: CalendarEvent) {
    setBusyId(e.id)
    try {
      const res = await fetch(`/api/calendar/${e.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !e.completed }),
      })
      if (!res.ok) throw new Error()
      await onChanged()
    } catch {
      toast.error("Couldn't update", "Please try again.")
    } finally {
      setBusyId(null)
    }
  }

  async function remove(e: CalendarEvent) {
    if (!confirm(`Delete "${e.title}"?`)) return
    setBusyId(e.id)
    try {
      const res = await fetch(`/api/calendar/${e.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      await onChanged()
    } catch {
      toast.error("Couldn't delete", "Please try again.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Modal open={open} onClose={close} size="md">
      <ModalHeader onClose={close}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Plan your day</p>
        <h2 className="text-lg font-semibold">{day ? dayTitleFormat.format(day) : ""}</h2>
      </ModalHeader>
      <ModalBody className="space-y-5">
        {events.length > 0 && (
          <ul className="space-y-2">
            {events.map(e => {
              const meta = TYPES[e.type]
              const Icon = meta.icon
              return (
                <li key={e.id} className={cn("flex items-start gap-3 rounded-2xl bg-muted p-3", busyId === e.id && "opacity-60")}>
                  <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", meta.chip)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-semibold", e.completed && "text-muted-foreground line-through")}>{e.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {meta.label} · {eventTimeLabel(e)}{e.moduleTitle && ` · ${e.moduleTitle}`}
                    </p>
                    {e.notes && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{e.notes}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleDone(e)}
                      disabled={busyId === e.id}
                      aria-label={e.completed ? "Mark as not done" : "Mark as done"}
                      title={e.completed ? "Mark as not done" : "Mark as done"}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
                        e.completed ? "border-green-600 bg-green-600 text-white" : "border-border bg-card hover:border-green-600 hover:text-green-600"
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(e)}
                      disabled={busyId === e.id}
                      aria-label={`Delete ${e.title}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {showForm && day ? (
          <EventForm
            key={dayKey(day)}
            day={day}
            modules={modules}
            onCancel={events.length > 0 ? () => setAdding(false) : undefined}
            onSaved={async () => {
              setAdding(false)
              await onChanged()
            }}
          />
        ) : (
          <Button variant="primary" className="w-full" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            Add to this day
          </Button>
        )}
      </ModalBody>
    </Modal>
  )
}

// ─── Add form ────────────────────────────────────────────────────────────────

function EventForm({
  day,
  modules,
  onCancel,
  onSaved,
}: {
  day: Date
  modules: ModuleOption[]
  onCancel?: () => void
  onSaved: () => Promise<void> | void
}) {
  const [type, setType] = useState<EventType>("STUDY_SESSION")
  const [title, setTitle] = useState("")
  const [moduleId, setModuleId] = useState("")
  const [allDay, setAllDay] = useState(false)
  const [startTime, setStartTime] = useState("18:00")
  const [endTime, setEndTime] = useState("19:00")
  const [dueTime, setDueTime] = useState("23:00")
  const [notes, setNotes] = useState("")
  const [repeatWeeks, setRepeatWeeks] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const hasRange = type === "STUDY_SESSION" || type === "EXAM"

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError("")

    let startAt: Date
    let endAt: Date | null = null
    if (allDay) {
      startAt = atTime(day, "00:00")
    } else if (type === "ASSIGNMENT" || type === "REMINDER") {
      startAt = atTime(day, dueTime)
    } else {
      startAt = atTime(day, startTime)
      endAt = atTime(day, endTime)
      if (endAt <= startAt) {
        setError("The end time must be after the start time.")
        return
      }
    }

    setSaving(true)
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim() || (moduleId ? `${TYPES[type].label} – ${modules.find(m => m.id === moduleId)?.title}` : TYPES[type].label),
          moduleId: moduleId || undefined,
          startAt: startAt.toISOString(),
          endAt: endAt?.toISOString() ?? null,
          allDay,
          notes,
          repeatWeeks: type === "STUDY_SESSION" ? repeatWeeks : 1,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Could not save")
      toast.success("Saved", data.created > 1 ? `Added ${data.created} weekly sessions` : `${TYPES[type].label} added`)
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save")
    } finally {
      setSaving(false)
    }
  }

  const fieldClass = "neo-inset h-11 w-full rounded-full border-0 bg-transparent px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">What are you adding?</p>
        <div className="grid grid-cols-2 gap-2">
          {TYPE_ORDER.map(t => {
            const meta = TYPES[t]
            const Icon = meta.icon
            const active = type === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {meta.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label htmlFor="event-title" className="mb-1.5 block text-sm font-medium">Title</label>
        <Input
          id="event-title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={
            type === "STUDY_SESSION" ? "e.g. Revise chapter 4: pointers"
              : type === "ASSIGNMENT" ? "e.g. Assignment 2"
                : type === "EXAM" ? "e.g. COS1511 exam"
                  : "e.g. Register for exams"
          }
          maxLength={200}
        />
      </div>

      {modules.length > 0 && (
        <div>
          <label htmlFor="event-module" className="mb-1.5 block text-sm font-medium">Module (optional)</label>
          <select id="event-module" value={moduleId} onChange={e => setModuleId(e.target.value)} className={fieldClass}>
            <option value="">No module</option>
            {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} className="h-4 w-4 accent-[var(--neo-primary)]" />
        All day
      </label>

      {!allDay && (hasRange ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="event-start" className="mb-1.5 block text-sm font-medium">Starts</label>
            <input id="event-start" type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="event-end" className="mb-1.5 block text-sm font-medium">Ends</label>
            <input id="event-end" type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} className={fieldClass} />
          </div>
        </div>
      ) : (
        <div>
          <label htmlFor="event-due" className="mb-1.5 block text-sm font-medium">{type === "ASSIGNMENT" ? "Due at" : "Time"}</label>
          <input id="event-due" type="time" required value={dueTime} onChange={e => setDueTime(e.target.value)} className={fieldClass} />
        </div>
      ))}

      {type === "STUDY_SESSION" && (
        <div>
          <label htmlFor="event-repeat" className="mb-1.5 block text-sm font-medium">Repeat</label>
          <select id="event-repeat" value={repeatWeeks} onChange={e => setRepeatWeeks(Number(e.target.value))} className={fieldClass}>
            <option value={1}>Doesn&apos;t repeat</option>
            <option value={2}>Weekly for 2 weeks</option>
            <option value={4}>Weekly for 4 weeks</option>
            <option value={8}>Weekly for 8 weeks</option>
            <option value={12}>Weekly for 12 weeks</option>
          </select>
        </div>
      )}

      <div>
        <label htmlFor="event-notes" className="mb-1.5 block text-sm font-medium">Notes (optional)</label>
        <textarea
          id="event-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Chapters to cover, submission link, venue…"
          className="neo-inset w-full resize-none rounded-2xl border-0 bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        />
      </div>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" className="flex-1" disabled={saving}>
          {saving ? "Saving…" : `Add ${TYPES[type].label.toLowerCase()}`}
        </Button>
      </div>
    </form>
  )
}
