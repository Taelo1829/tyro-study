"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const LABELS: Record<string, string> = { new: "New", planned: "Planned", done: "Done", wontfix: "Won't do" }

/** Admin triage: change a feedback item's status (and optionally its note). */
export function FeedbackStatusSelect({ id, status, note }: { id: string; status: string; note: string | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState(note ?? "")
  const save = async (body: Record<string, unknown>) => {
    setBusy(true)
    await fetch(`/api/admin/feedback/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => {})
    setBusy(false)
    router.refresh()
  }
  return (
    <div className="flex flex-col gap-2">
      <label className="sr-only" htmlFor={`status-${id}`}>Status</label>
      <select id={`status-${id}`} value={status} disabled={busy} onChange={e => save({ status: e.target.value })} className="min-h-10 rounded-xl border border-border bg-background px-2 text-sm">
        {Object.entries(LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <label className="sr-only" htmlFor={`note-${id}`}>Note</label>
      <input id={`note-${id}`} value={draft} placeholder="Note / backlog id" onChange={e => setDraft(e.target.value)} onBlur={() => draft !== (note ?? "") && save({ adminNote: draft })} className="min-h-10 rounded-xl border border-border bg-background px-2 text-sm" />
    </div>
  )
}
