"use client"
import { useState } from "react"
import { Flag } from "lucide-react"
import { Button } from "@/components/ui/button"

export function FlagQuestion({ attemptId, questionId }: { attemptId: string; questionId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("Incorrect answer")
  const [details, setDetails] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  async function submit() {
    setBusy(true); setError("")
    try {
      const res = await fetch("/api/quiz/flag", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attemptId, questionId, reason, details }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't send the report")
      setSent(true); setOpen(false)
    } catch (error) { setError(error instanceof Error ? error.message : "Couldn't send the report") }
    finally { setBusy(false) }
  }
  return <div className="my-3">
    <Button type="button" size="sm" variant="ghost" disabled={sent} aria-expanded={open} onClick={() => setOpen(!open)}><Flag className="h-4 w-4" />{sent ? "Question flagged" : "Flag question"}</Button>
    {sent && <p role="status" className="text-xs text-muted-foreground">Thanks. Your report has been sent for review.</p>}
    {open && <div className="mt-2 space-y-3 rounded-xl border bg-background p-4">
      <label className="block text-sm">What needs fixing?
        <select className="mt-1 block w-full rounded-lg border bg-background p-2" value={reason} disabled={busy} onChange={e => setReason(e.target.value)}>
          {["Incorrect answer", "Unclear question", "Missing information", "Wrong topic", "Other"].map(value => <option key={value}>{value}</option>)}
        </select>
      </label>
      <label className="block text-sm">Details (optional)
        <textarea className="mt-1 block w-full rounded-lg border bg-background p-2" rows={3} maxLength={1000} value={details} disabled={busy} onChange={e => setDetails(e.target.value)} placeholder="Tell us what seems wrong…" />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2"><Button type="button" size="sm" disabled={busy} onClick={() => void submit()}>{busy ? "Sending…" : "Send report"}</Button><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button></div>
    </div>}
  </div>
}
