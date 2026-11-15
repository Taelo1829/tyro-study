"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { buildWeeklyStudyPlan, studyToday, studyWeekEnd, type SavedStudyTask } from "@/lib/weekly-study-plan"
import type { TutorialGuide } from "@/lib/tutorial-letter-types"

export function WeeklyStudyPlanner({ moduleId, guide }: { moduleId: string; guide: TutorialGuide }) {
  const [tasks, setTasks] = useState<SavedStudyTask[]>([])
  const [enabled, setEnabled] = useState(false)
  const [start, setStart] = useState(studyToday)
  const [reminders, setReminders] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [adjust, setAdjust] = useState(false)
  const [filter, setFilter] = useState<"upcoming" | "all">("upcoming")
  useEffect(() => {
    let active = true
    fetch(`/api/modules/${moduleId}/weekly-plan`).then(async r => {
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      if (active) { setEnabled(data.enabled); setTasks(data.tasks) }
    }).catch(e => { if (active) setError(e.message || "Could not load your planner.") }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [moduleId])
  async function save(body: object, success: string) {
    setBusy(true); setError(""); setMessage("")
    try {
      const r = await fetch(`/api/modules/${moduleId}/weekly-plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const data = await r.json()
      if (!r.ok) { if (data.enabled === false) setEnabled(false); throw new Error(data.error) }
      setTasks(data); setAdjust(false); setMessage(success)
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save your planner.") }
    finally { setBusy(false) }
  }
  if (!guide.studyPlan.length || !enabled) return null
  const today = studyToday()
  const complete = tasks.filter(t => t.completed).length
  const overdue = tasks.filter(t => !t.completed && studyWeekEnd(t.date) < today)
  const pending = tasks.filter(t => !t.completed)
  const visible = filter === "all" ? tasks : pending.slice(0, 6)
  let preview: ReturnType<typeof buildWeeklyStudyPlan> = []
  let previewError = ""
  if (!tasks.length && !loading) {
    try { preview = buildWeeklyStudyPlan(guide, start) } catch (e) { previewError = e instanceof Error ? e.message : "Invalid schedule" }
  }
  const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric" })
  return <section className="mb-6 space-y-4 rounded-xl border bg-card p-5" aria-label="Weekly study planner">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Your weekly study planner</h2><p className="text-sm text-muted-foreground">Follow the letter’s reading sequence at your own pace.</p></div><Link href="/timetable" className="text-sm underline">Open timetable</Link></div>
    <p className="text-xs text-muted-foreground">Personal study targets, not official assignment deadlines. Guidance comes from your {guide.year} tutorial letter.</p>
    {loading ? <p role="status" className="text-sm">Loading your plan…</p> : <>
      {!!tasks.length && <>
        <div className="flex justify-between gap-3 text-sm"><span>{complete} / {tasks.length} weekly goals complete</span><span>{Math.round(complete / tasks.length * 100)}%</span></div>
        <progress className="h-2 w-full accent-black" value={complete} max={tasks.length} aria-label="Weekly study goals completed" />
        {!!overdue.length && <div className="rounded-lg bg-muted p-3 text-sm">{overdue.length} unfinished goal{overdue.length === 1 ? " is" : "s are"} past the planned week. You can move unfinished work forward without losing completed goals.</div>}
        <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy} onClick={() => { setAdjust(!adjust); setStart(today); setReminders(pending.some(t => t.reminders)) }}>Adjust unfinished weeks</Button><Button size="sm" disabled={busy} onClick={() => setFilter(filter === "all" ? "upcoming" : "all")}>{filter === "all" ? "Show next goals" : "Show all weeks"}</Button></div>
      </>}
      {(!tasks.length || adjust) && <form className="space-y-3 rounded-lg border p-4" onSubmit={e => { e.preventDefault(); void save({ action: tasks.length ? "reschedule" : "create", startDate: start, reminders }, tasks.length ? "Unfinished goals rescheduled. Completed goals were kept." : "Your weekly plan is ready and has been added to your timetable.") }}>
        <label className="block text-sm font-medium">{tasks.length ? "Resume unfinished work on" : "Start studying on"}<input type="date" required value={start} disabled={busy} onChange={e => setStart(e.target.value)} className="mt-1 block rounded-md border bg-background px-3 py-2" /></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reminders} disabled={busy} onChange={e => setReminders(e.target.checked)} className="mt-1" /><span>Remind me at 09:00 South Africa time on each planned study date. Enable notifications in your account to receive reminders.</span></label>
        {tasks.length ? <p className="text-xs text-muted-foreground">Schedules one unfinished weekly goal per week from this date. Completed work and other calendar entries stay in place.</p> : <p className="text-sm">{preview.length ? `${preview.length} weekly goals · ${dateLabel(preview[0].date)} to ${dateLabel(preview[preview.length - 1].date)}` : previewError}</p>}
        <Button variant="primary" disabled={busy || (!tasks.length && !preview.length)} type="submit">{busy ? "Saving…" : tasks.length ? "Reschedule unfinished goals" : "Create my weekly plan"}</Button>
      </form>}
      {!!tasks.length && !pending.length && <p className="text-sm font-medium">All weekly study goals complete.</p>}
      <ul className="space-y-2">{visible.map(t => <li key={t.id} className="rounded-lg border p-3"><div className="flex items-start gap-3"><input type="checkbox" checked={t.completed} disabled={busy} aria-label={`Complete ${t.title}`} onChange={e => void save({ action: "complete", taskId: t.id, completed: e.target.checked }, "Progress saved.")} className="mt-1 h-4 w-4" /><div className="min-w-0 flex-1"><p className={`font-medium ${t.completed ? "text-muted-foreground line-through" : ""}`}>{t.title}</p><p className="text-xs text-muted-foreground">{dateLabel(t.date)} – {dateLabel(studyWeekEnd(t.date))}{!t.completed && studyWeekEnd(t.date) < today ? " · Catch up" : ""}</p><details className="mt-2 text-sm"><summary className="cursor-pointer">Readings and weekly goal</summary><p className="mt-2 whitespace-pre-line text-muted-foreground">{t.notes}</p></details></div></div></li>)}</ul>
      {filter === "upcoming" && pending.length > 6 && <p className="text-xs text-muted-foreground">Showing your next 6 unfinished goals. Choose “Show all weeks” for the full plan.</p>}
    </>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>
}
