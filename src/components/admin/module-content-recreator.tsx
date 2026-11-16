"use client"
import { generationFetch, queueGeneration, waitForGeneration } from "@/lib/generation-client"

import { DocumentUpload } from "@/components/ui/document-upload"
import { useEffect, useRef, useState } from "react"
import { Download, Loader2, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TopicContentView } from "@/components/topic/topic-content-view"
import type { RecreatedQuestion } from "@/lib/module-recreation-input"
import type { ExamDraft } from "@/lib/exam-structure"
import { MAX_PAPER_BYTES, MAX_PAPER_FILES, parsePaperSources, type PaperSource } from "@/lib/module-recreation-input"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "./modal"
import { readPaperFile } from "./read-paper-file"

type Outline = { title: string; chapters: { id: string; title: string; topics: { id: string; title: string; content: string | null }[] }[] }
type Row = { id: string; title: string; chapter: string; status: "waiting" | "writing" | "ready" | "skipped" | "failed"; html?: string; quizUnchanged?: boolean; quizNote?: string; questions?: RecreatedQuestion[]; version?: string; note?: string; selected: boolean }
type Draft = { topicId: string; skipped: true; reason: string } | { topicId: string; skipped: false; version: string; html: string; quizUnchanged?: boolean; quizNote?: string; questions?: RecreatedQuestion[] }

async function post<T>(url: string, body: unknown): Promise<T> {
  const payload = JSON.stringify(body)
  if (new TextEncoder().encode(payload).length > 3_000_000) throw new Error("This batch is too large. Select fewer papers or lessons.")
  const res = await generationFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? "The request failed. Please try again.")
  return data as T
}

export function ModuleContentRecreator({ moduleId, onSaved }: { moduleId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [outline, setOutline] = useState<Outline | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [paperSettings, setPaperSettings] = useState<Record<string, { kind: "assignment" | "exam"; format: "auto" | "mcq" | "written" | "mixed" }>>({})
  const [sources, setSources] = useState<PaperSource[] | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [referenceIndex, setReferenceIndex] = useState("-1")
  const [assessment, setAssessment] = useState<{ exam: ExamDraft | null; reason: string } | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [saved, setSaved] = useState<number | null>(null)
  const stop = useRef(false)
  const endpoint = `/api/admin/modules/${moduleId}/recreate-content`
  const ready = rows.filter(r => r.status === "ready")
  const chosen = ready.filter(r => r.selected)
  const remaining = rows.filter(r => r.status === "waiting" || r.status === "failed")

  useEffect(() => () => { stop.current = true }, [])

  async function show(reset = false) {
    setOpen(true)
    if (outline && !reset) return
    setBusy(true)
    setError("")
    setMessage("Loading the current chapters and topics…")
    try {
      const res = await generationFetch(endpoint)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't load the module.")
      const next = data as Outline
      setOutline(next)
      setRows(next.chapters.flatMap(c => c.topics.map(t => ({ id: t.id, title: t.title, chapter: c.title, status: "waiting" as const, selected: true }))))
      setSources(null)
      setPaperSettings({})
      setAssessment(null)
      setConfirmed(false)
      setReferenceIndex("-1")
      setFiles([])
      setSaved(null)
      setMessage("")
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't load the module.") }
    finally { setBusy(false) }
  }

  function addFiles(incoming: FileList | File[] | null) {
    if (!incoming) return
    const next = [...files]
    for (const file of Array.from(incoming)) {
      if (!/\.pdf$/i.test(file.name) || file.size > MAX_PAPER_BYTES) { setError("Choose PDF files up to 10 MB each."); return }
      if (!next.some(f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) next.push(file)
    }
    if (next.length > MAX_PAPER_FILES) { setError(`Choose up to ${MAX_PAPER_FILES} files per batch.`); return }
    setFiles(next)
    setError("")
  }

  async function generate() {
    setBusy(true)
    setError("")
    stop.current = false
    try {
      let material = sources
      if (!material) {
        const read: PaperSource[] = []
        for (const file of files) {
          if (stop.current) break
          read.push({ ...await readPaperFile(file, setMessage), ...(paperSettings[file.name] ?? { kind: "assignment", format: "auto" }), ...(files.indexOf(file) === Number(referenceIndex) ? { kind: "exam" as const } : {}) })
          parsePaperSources(read) // Reject oversized material; never silently truncate papers.
        }
        if (stop.current) { setMessage("Stopped. Your current lessons are unchanged."); return }
        material = parsePaperSources(read)
        setSources(material)
      }
      const jobId = await queueGeneration([{ path: endpoint, body: { action: "assignments", sources: material }, continueWith: "recreate-lessons", options: { topics: remaining.map(r => ({ id: r.id, title: r.title })), referenceIndex: Number(referenceIndex) } }], "Module lesson and assessment drafts")
      setMessage("Drafting in the background. You can leave or close the app; results are saved in Generation activity.")
      const job = await waitForGeneration(jobId)
      for (const entry of job.results) {
        if (entry.task.body.action === "exam") { setAssessment(entry.data as { exam: ExamDraft | null; reason: string }); setConfirmed(false) }
        if (entry.task.body.action !== "draft") continue
        const draft = entry.data as Draft
        setRows(previous => previous.map(r => r.id !== entry.task.body.topicId ? r : draft.skipped
          ? { ...r, status: "skipped", note: draft.reason, selected: false }
          : { ...r, status: "ready", html: draft.html, version: draft.version, questions: draft.questions, quizUnchanged: draft.quizUnchanged, quizNote: draft.quizNote, selected: true }))
      }
      if (Number(referenceIndex) < 0) setAssessment({ exam: null, reason: "No previous exam was selected. The mock exam will be unavailable." })
      setMessage("Review the lessons, quizzes and mock exam decision below before saving.")
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't read the papers.") }
    finally { setBusy(false) }
  }

  async function save() {
    setBusy(true)
    setError("")
    setMessage("Saving selected lessons…")
    try {
      const result = await post<{ saved: number }>(endpoint, { action: "save", lessons: chosen.map(r => ({ topicId: r.id, version: r.version, html: r.html, questions: r.questions, quizUnchanged: r.quizUnchanged })), assessment: { ...assessment, confirmed }, sources, referenceIndex: Number(referenceIndex) })
      setSaved(result.saved)
      setMessage(`${result.saved} topic${result.saved === 1 ? "" : "s"} updated with lessons and quizzes. The mock exam decision is saved. The module, chapters and topics are preserved.`)
      onSaved()
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't save the lessons.") }
    finally { setBusy(false) }
  }

  function downloadOriginals() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(outline, null, 2)], { type: "application/json" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `module-${moduleId}-original-lessons.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <>
      <Button size="sm" onClick={() => void show()}><RefreshCw className="h-4 w-4" />Recreate content</Button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} size="xl" persistent={busy}>
        <ModalHeader onClose={busy ? undefined : () => setOpen(false)}>Recreate module content</ModalHeader>
        <ModalBody className="space-y-5">
          <p className="text-sm text-muted-foreground">Upload assignments or past question papers to draft replacement lessons and quizzes for {outline?.title ?? "this module"}. The module → chapter → topic structure, titles and ordering stay intact. Topic and chapter quizzes follow the assignment format: choice, written, or mixed. Written answers can be submitted as photos or PDFs. Existing attempts, flashcards and projects are kept. Topics not covered by the papers keep their current content. A mock exam is available only when a selected previous exam can be reproduced faithfully.</p>
          {!sources && saved === null && (
            <div className="space-y-3 rounded-2xl border border-dashed border-border p-4">
              <label htmlFor={`papers-${moduleId}`} className="block font-medium">Assignments and previous papers</label>
              <DocumentUpload id={`papers-${moduleId}`} multiple accept="application/pdf,.pdf" disabled={busy} files={files} showFiles={false} hint="Assignments or previous papers · Up to 20 PDFs, 10 MB each" onSelect={addFiles} />
              <p className="text-xs text-muted-foreground">Choose up to 20 PDFs, 10 MB and 100 pages each. Scanned pages are supported. Up to 120,000 extracted characters per batch.</p>
              {!!files.length && <div className="space-y-2">
                <label htmlFor={`reference-${moduleId}`} className="block text-sm font-semibold">Previous exam to follow exactly</label>
                <select id={`reference-${moduleId}`} value={referenceIndex} disabled={busy} onChange={e => setReferenceIndex(e.target.value)} className="w-full rounded-xl border border-border bg-card p-3 text-sm">
                  <option value="-1">No previous exam — do not create a mock exam</option>
                  {files.map((file, i) => <option key={i} value={i}>{file.name}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">Select an actual previous exam, not an assignment. If papers use different formats, this one defines the mock. Its question order, sections, counts, marks and duration must be verifiable.</p>
              </div>}
              <div className="space-y-3">{files.map((file, i) => <div key={`${file.name}:format`} className="grid gap-2 sm:grid-cols-3">
                <span className="break-words text-sm">{file.name}</span>
                <select aria-label={`Paper type for ${file.name}`} disabled={busy || Number(referenceIndex) === i} value={Number(referenceIndex) === i ? "exam" : paperSettings[file.name]?.kind ?? "assignment"} onChange={e => setPaperSettings(prev => ({ ...prev, [file.name]: { kind: e.target.value as "assignment" | "exam", format: prev[file.name]?.format ?? "auto" } }))} className="rounded-lg border border-border bg-card p-2 text-sm"><option value="assignment">Assignment</option><option value="exam">Previous exam</option></select>
                {Number(referenceIndex) !== i && paperSettings[file.name]?.kind !== "exam" && <select aria-label={`Assignment format for ${file.name}`} disabled={busy} value={paperSettings[file.name]?.format ?? "auto"} onChange={e => setPaperSettings(prev => ({ ...prev, [file.name]: { kind: "assignment", format: e.target.value as "auto" | "mcq" | "written" | "mixed" } }))} className="rounded-lg border border-border bg-card p-2 text-sm"><option value="auto">Detect format</option><option value="mcq">All multiple choice</option><option value="written">All written</option><option value="mixed">Mixed (match each topic)</option></select>}
              </div>)}</div>
              <ul className="space-y-2 text-sm">{files.map((file, i) => <li key={`${file.name}:${file.lastModified}`} className="flex items-center justify-between gap-3"><span className="min-w-0 break-words">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</span><button type="button" disabled={busy} aria-label={`Remove ${file.name}`} onClick={() => { setFiles(previous => previous.filter((_, j) => i !== j)); setReferenceIndex("-1") }} className="p-2"><X className="h-4 w-4" /></button></li>)}</ul>
            </div>
          )}
          {sources && <p className="text-sm text-muted-foreground">Using {sources.length} paper{sources.length === 1 ? "" : "s"}: {sources.map(s => s.name).join(", ")}</p>}
          {assessment && <section className="space-y-3 rounded-2xl border border-border p-4">
            <h3 className="font-semibold">Mock exam</h3>
            {assessment.exam ? <>
              <p className="text-sm">Reference: {assessment.exam.sourceName} · {assessment.exam.totalQuestions} questions · {assessment.exam.totalMarks} marks · {assessment.exam.durationMinutes} minutes</p>
              <p className="whitespace-pre-wrap text-sm">{assessment.exam.instructions}</p>
              {assessment.exam.sections.map((section, i) => <details key={i}>
                <summary className="cursor-pointer text-sm font-medium">{section.title || "Questions"} · {section.questions.length} questions</summary>
                <p className="my-2 text-sm">{section.instructions}</p>
                <ol className="space-y-3">{section.questions.map(q => <li key={q.label} className="rounded-xl bg-muted p-3 text-sm"><p className="whitespace-pre-wrap font-medium">{q.label}. {q.question} ({q.marks} marks)</p><ul className="my-2 list-inside list-disc">{q.options.map((o, j) => <li key={j}>{o}</li>)}</ul><p>Draft answer: {q.correctOption}</p></li>)}</ol>
              </details>)}
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy || saved !== null} onChange={e => setConfirmed(e.target.checked)} className="mt-1" />I checked the original paper: sections, question types/order/count, marks, duration, instructions and answers match. Publish this mock exam.</label>
            </> : <p className="text-sm text-muted-foreground">{assessment.reason} No substitute or randomly assembled mock exam will be created.</p>}
          </section>}
          {outline && rows.length === 0 && <p className="rounded-xl bg-muted p-4 text-sm">Add chapters and topics first. This tool fills the structure you already have.</p>}
          {message && <p role="status" className="flex items-center gap-2 text-sm">{busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}{message}</p>}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {!!rows.length && <div className="space-y-3">{rows.map(row => (
            <div key={row.id} className="rounded-2xl border border-border p-4">
              <div className="flex items-start gap-3">
                {row.status === "ready" && saved === null && <input aria-label={`Replace ${row.title}`} type="checkbox" checked={row.selected} disabled={busy} onChange={e => setRows(previous => previous.map(r => r.id === row.id ? { ...r, selected: e.target.checked } : r))} className="mt-1 h-4 w-4 accent-black" />}
                <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{row.chapter}</p><p className="font-medium">{row.title}</p></div>
                <span className="text-xs text-muted-foreground">{row.status === "ready" ? "Draft ready" : row.status === "writing" ? "Writing…" : row.status === "skipped" ? "Kept as is" : row.status === "failed" ? "Needs retry" : "Waiting"}</span>
              </div>
              {row.quizNote && <p className="mt-2 text-sm font-medium">Quiz format: {row.quizNote}</p>}
              {row.note && <p className="mt-2 text-sm text-muted-foreground">{row.note}</p>}
              {row.questions && <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Review {row.questions.length} quiz questions</summary><ol className="mt-3 space-y-3">{row.questions.map((q, i) => <li key={i} className="rounded-xl bg-muted p-3 text-sm"><p className="whitespace-pre-wrap font-medium">{i + 1}. {q.question}</p><ul className="my-2 list-inside list-disc">{q.options.map((o, j) => <li key={j}>{o}</li>)}</ul>{q.kind === "written" ? <><p className="font-semibold">Written · {q.marks} marks</p><p className="whitespace-pre-wrap">Model answer: {q.modelAnswer}</p><ul>{q.rubric?.map((r, n) => <li key={n}>{r.criterion} — {r.marks} marks</li>)}</ul></> : <p>Multiple choice · Answer: {q.correctOption}</p>}{q.explanation && <p>{q.explanation}</p>}</li>)}</ol></details>}
              {row.html && <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Review replacement lesson</summary><div className="mt-4 max-h-96 overflow-y-auto"><TopicContentView content={row.html} /></div></details>}
            </div>
          ))}</div>}
          {ready.length > 0 && saved === null && <p className="text-sm font-medium">Saving replaces the lessons and active quiz pools for the {chosen.length} selected topic{chosen.length === 1 ? "" : "s"}. Previous quiz attempts are retained. Review each draft first.</p>}
        </ModalBody>
        <ModalFooter className="flex-wrap">
          {outline && <Button size="sm" variant="ghost" onClick={downloadOriginals}><Download className="h-4 w-4" />Download original lessons</Button>}
          {busy ? <Button variant="ghost" onClick={() => setOpen(false)}>Continue in background</Button> : <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>}
          {!busy && (sources || saved !== null) && <Button variant="ghost" onClick={() => void show(true)}>Start a new batch</Button>}
          {saved === null && remaining.length > 0 && <Button onClick={() => void generate()} disabled={busy || !files.length || !outline} variant="primary">{sources ? "Draft remaining topics" : "Generate content and quizzes"}</Button>}
          {saved === null && assessment && <Button onClick={() => void save()} disabled={busy || (!!assessment.exam && !confirmed)} variant="primary">Save {chosen.length} topics and mock decision</Button>}
          {!outline && !busy && <Button onClick={() => void show(true)}>Retry loading</Button>}
        </ModalFooter>
      </Modal>
    </>
  )
}
