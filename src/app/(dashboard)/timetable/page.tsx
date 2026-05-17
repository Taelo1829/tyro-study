"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, CheckCircle2, Plus, Trash2 } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface ModuleOption {
  id: string
  title: string
}

interface TimetableEntry {
  id: string
  moduleId: string | null
  assignmentTitle: string
  startDate: string
  dueDate: string
  chaptersPlanned: number
  chaptersCompleted: number
  module: ModuleOption | null
}

const emptyForm = {
  assignmentTitle: "",
  moduleId: "",
  startDate: "",
  dueDate: "",
  chaptersPlanned: "0",
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function getStatus(entry: TimetableEntry) {
  if (entry.chaptersPlanned > 0 && entry.chaptersCompleted >= entry.chaptersPlanned) {
    return "Complete"
  }

  if (new Date(entry.dueDate).getTime() < Date.now()) {
    return "Overdue"
  }

  return "Planned"
}

export default function TimetablePage() {
  const [entries, setEntries] = useState<TimetableEntry[]>([])
  const [modules, setModules] = useState<ModuleOption[]>([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const sortedEntries = useMemo(
    () =>
      [...entries].sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      ),
    [entries]
  )

  useEffect(() => {
    let cancelled = false

    Promise.all([fetch("/api/timetable"), fetch("/api/enrollments")])
      .then(async ([timetableRes, enrollmentsRes]) => {
        if (!timetableRes.ok) throw new Error("Failed to load timetable")
        const nextEntries = await timetableRes.json()
        const nextModules = enrollmentsRes.ok ? await enrollmentsRes.json() : []

        if (!cancelled) {
          setEntries(nextEntries)
          setModules(nextModules)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load timetable")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function createEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSaving(true)

    try {
      const res = await fetch("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentTitle: form.assignmentTitle,
          moduleId: form.moduleId || undefined,
          startDate: form.startDate,
          dueDate: form.dueDate,
          chaptersPlanned: Number(form.chaptersPlanned),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to save timetable entry")

      setEntries((current) => [...current, data])
      setForm(emptyForm)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save timetable entry")
    } finally {
      setSaving(false)
    }
  }

  async function updateCompleted(entry: TimetableEntry, completed: number) {
    const nextCompleted = Math.max(0, Math.min(completed, entry.chaptersPlanned))
    const res = await fetch(`/api/timetable/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chaptersCompleted: nextCompleted }),
    })

    if (!res.ok) return
    const updated = await res.json()
    setEntries((current) =>
      current.map((item) => (item.id === updated.id ? updated : item))
    )
  }

  async function deleteEntry(id: string) {
    const res = await fetch(`/api/timetable/${id}`, { method: "DELETE" })
    if (!res.ok) return
    setEntries((current) => current.filter((entry) => entry.id !== id))
  }

  return (
    <>
      <Header title="Timetable" subtitle="Plan study sessions and track assignments" />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Add timetable entry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createEntry} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Title</label>
                <Input
                  required
                  value={form.assignmentTitle}
                  placeholder="Assignment, revision session, or exam prep"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      assignmentTitle: event.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Module</label>
                <select
                  value={form.moduleId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, moduleId: event.target.value }))
                  }
                  className="neo-inset flex h-10 w-full rounded-[var(--neo-radius)] border-0 bg-transparent px-4 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <option value="">No module</option>
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Start</label>
                  <Input
                    required
                    type="datetime-local"
                    value={form.startDate}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, startDate: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Due</label>
                  <Input
                    required
                    type="datetime-local"
                    value={form.dueDate}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, dueDate: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Chapters planned</label>
                <Input
                  min={0}
                  type="number"
                  value={form.chaptersPlanned}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      chaptersPlanned: event.target.value,
                    }))
                  }
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Saving..." : "Add to timetable"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              My timetable
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Loading timetable...
              </p>
            ) : sortedEntries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Your study schedule will appear here.
              </p>
            ) : (
              <div className="space-y-3">
                {sortedEntries.map((entry) => {
                  const status = getStatus(entry)
                  const progress =
                    entry.chaptersPlanned > 0
                      ? Math.round((entry.chaptersCompleted / entry.chaptersPlanned) * 100)
                      : 0

                  return (
                    <div key={entry.id} className="neo-inset rounded-[var(--neo-radius)] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold">{entry.assignmentTitle}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.module?.title ?? "Personal study"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            {status}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteEntry(entry.id)}
                            title="Delete timetable entry"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                        <p>
                          <span className="text-muted-foreground">Start:</span>{" "}
                          {formatDateTime(entry.startDate)}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Due:</span>{" "}
                          {formatDateTime(entry.dueDate)}
                        </p>
                      </div>

                      {entry.chaptersPlanned > 0 && (
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              {entry.chaptersCompleted}/{entry.chaptersPlanned} chapters
                            </span>
                            <span>{progress}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="inset"
                            size="sm"
                            disabled={entry.chaptersCompleted >= entry.chaptersPlanned}
                            onClick={() =>
                              updateCompleted(entry, entry.chaptersCompleted + 1)
                            }
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Mark chapter done
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
