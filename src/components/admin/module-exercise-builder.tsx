"use client"

import { useRef, useState } from "react"
import { Loader2, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "./modal"

/**
 * Admin, coding modules: write "Try it yourself" exercises (and type-the-answer
 * quiz questions) for every topic that has a lesson but no exercises yet,
 * one topic at a time.
 */

type Row = { id: string; title: string; status: "waiting" | "writing" | "done" | "failed"; note?: string }

export function ModuleExerciseBuilder({ moduleId }: { moduleId: string }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [haveAll, setHaveAll] = useState(0)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")
  const stop = useRef(false)

  async function show() {
    setOpen(true)
    setRows(null)
    setError("")
    const res = await fetch(`/api/modules/${moduleId}/exercises`)
    if (!res.ok) {
      setError("Couldn't load the topics")
      return
    }
    const data = (await res.json()) as { topics: { id: string; title: string; exercises: number }[] }
    setHaveAll(data.topics.filter(t => t.exercises > 0).length)
    setRows(data.topics.filter(t => t.exercises === 0).map(t => ({ id: t.id, title: t.title, status: "waiting" })))
  }

  async function run() {
    if (!rows) return
    setRunning(true)
    stop.current = false
    for (const row of rows) {
      if (stop.current) break
      if (row.status === "done") continue
      setRows(prev => prev!.map(r => (r.id === row.id ? { ...r, status: "writing", note: undefined } : r)))
      try {
        const res = await fetch(`/api/topics/${row.id}/exercises/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exercises: 2, questions: 5 }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? "Failed")
        const note = `${data.exercises} exercise${data.exercises === 1 ? "" : "s"}, ${data.questions} question${data.questions === 1 ? "" : "s"}`
        setRows(prev => prev!.map(r => (r.id === row.id ? { ...r, status: "done", note } : r)))
      } catch (err) {
        const note = err instanceof Error ? err.message : "Failed"
        setRows(prev => prev!.map(r => (r.id === row.id ? { ...r, status: "failed", note } : r)))
        // A missing database update or API key fails every topic the same way: stop
        if (/migrate deploy|OPENAI_API_KEY/.test(note)) break
      }
    }
    setRunning(false)
  }

  const left = rows?.filter(r => r.status !== "done").length ?? 0

  return (
    <>
      <Button size="sm" onClick={show}>
        <Terminal className="h-4 w-4" />
        Try-it exercises
      </Button>
      <Modal open={open} onClose={() => !running && setOpen(false)} size="lg" persistent={running}>
        <ModalHeader onClose={running ? undefined : () => setOpen(false)}>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Terminal className="h-5 w-5" />
            &ldquo;Try it yourself&rdquo; for every topic
          </h2>
        </ModalHeader>
        <ModalBody className="space-y-4">
          <p className="text-sm text-muted-foreground">
            For each topic with a lesson and no exercises yet, the AI writes 2 fill-in-the-blank code exercises (shown after the
            lesson) and 5 type-the-answer quiz questions. It takes about half a minute a topic; keep this window open.
          </p>
          {!rows && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {rows && (
            <>
              <p className="text-sm">
                {rows.length === 0
                  ? "Every topic with a lesson already has exercises."
                  : `${rows.length} topic${rows.length === 1 ? "" : "s"} to do${haveAll ? ` (${haveAll} already ${haveAll === 1 ? "has" : "have"} exercises)` : ""}.`}
              </p>
              <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
                {rows.map(r => (
                  <li key={r.id} className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-center">
                      {r.status === "writing" ? <Loader2 className="h-4 w-4 animate-spin" /> : r.status === "done" ? "✓" : r.status === "failed" ? "✗" : "·"}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{r.title}</span>
                    {r.note && <span className={r.status === "failed" ? "text-red-600" : "text-muted-foreground"}>{r.note}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          {running ? (
            <Button variant="ghost" onClick={() => (stop.current = true)}>
              Stop after this topic
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          )}
          {rows && left > 0 && (
            <Button variant="primary" onClick={run} disabled={running}>
              {running ? "Writing…" : rows.some(r => r.status === "failed") ? `Retry ${left}` : `Write for ${left} topic${left === 1 ? "" : "s"}`}
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </>
  )
}
