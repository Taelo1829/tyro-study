"use client"
import { useState } from "react"
import Link from "next/link"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "./modal"
type Assignment = { id: string; title: string; chapter: string }
export function UploadedAssignmentList({ moduleId, assignments, onDeleted }: { moduleId: string; assignments: Assignment[]; onDeleted: () => void }) {
  const [selected, setSelected] = useState<Assignment | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function remove() {
    if (!selected || busy) return
    setBusy(true); setError("")
    try {
      const res = await fetch(`/api/admin/modules/${moduleId}/assignments/${selected.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Could not delete the assignment.")
      setSelected(null); onDeleted()
    } catch (err) { setError(err instanceof Error ? err.message : "Could not delete the assignment.") }
    finally { setBusy(false) }
  }
  if (!assignments.length) return null
  return <section className="mb-6 rounded-2xl border border-border p-4">
    <h2 className="mb-3 font-semibold">Uploaded assignments</h2>
    <ul className="space-y-3">{assignments.map(a => <li key={a.id} className="flex items-center justify-between gap-3"><div><Link className="text-sm font-medium hover:underline" href={`/modules/${moduleId}/topics/${a.id}`}>{a.title}</Link><p className="text-xs text-muted-foreground">After {a.chapter}</p></div><Button size="sm" variant="ghost" aria-label={`Delete ${a.title}`} onClick={() => { setSelected(a); setError("") }}><Trash2 className="h-4 w-4" />Delete</Button></li>)}</ul>
    <Modal open={!!selected} onClose={() => { if (!busy) setSelected(null) }} persistent={busy}>
      <ModalHeader><h2 className="font-semibold">Delete uploaded assignment?</h2></ModalHeader>
      <ModalBody className="space-y-3"><p className="font-medium">{selected?.title}</p><p className="text-sm">This permanently deletes the generated quiz/checkpoint, its questions, answers, marking feedback and student attempts for this assignment. The module’s other topics and chapters are kept.</p>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}</ModalBody>
      <ModalFooter><Button variant="ghost" disabled={busy} onClick={() => setSelected(null)}>Cancel</Button><Button disabled={busy} onClick={() => void remove()} className="bg-red-600 text-white hover:bg-red-700">{busy ? "Deleting…" : "Delete assignment and content"}</Button></ModalFooter>
    </Modal>
  </section>
}
