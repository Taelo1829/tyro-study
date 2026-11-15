"use client"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export function WeeklyPlannerControl({ moduleId }: { moduleId: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    fetch(`/api/admin/modules/${moduleId}/weekly-planner`).then(async r => {
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      if (active) setEnabled(data.enabled)
    }).catch(e => { if (active) setError(e.message || "Could not load setting.") })
    return () => { active = false }
  }, [moduleId])
  async function toggle() {
    setBusy(true); setError("")
    try {
      const r = await fetch(`/api/admin/modules/${moduleId}/weekly-planner`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !enabled }) })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setEnabled(data.enabled)
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save setting.") }
    finally { setBusy(false) }
  }
  return <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3">
    <div className="min-w-0 flex-1 text-sm"><p className="font-medium">Study guide & weekly planner</p><p className="text-muted-foreground">Turn off to hide this module’s study guide, weekly planner and its timetable goals, and pause their reminders. Saved plans and progress return when enabled.</p><p className="mt-1 text-xs text-muted-foreground">Off by default. Requires an imported tutorial letter; weekly goals also need a study schedule.</p>{error && <p role="alert" className="mt-1 text-red-600">{error}</p>}</div>
    <Button role="switch" aria-label="Study guide & weekly planner" aria-checked={enabled ?? false} disabled={busy || enabled === null} variant={enabled ? "primary" : "outline"} size="sm" onClick={() => void toggle()}>{busy ? "Saving…" : enabled === null ? "Loading…" : enabled ? "On" : "Off"}</Button>
  </section>
}
