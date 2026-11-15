"use client"
import { useRef, useState } from "react"
import { BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DocumentUpload } from "@/components/ui/document-upload"
import { TutorialGuideContent } from "@/components/modules/tutorial-study-guide"
import { TUTORIAL_TOPIC_QUIZ_SIZE, tutorialCheckpointIndex, type TutorialPreview } from "@/lib/tutorial-letter-types"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "./modal"
import { readPaperFile } from "./read-paper-file"
import type { RecreatedQuestion } from "@/lib/module-recreation-input"

export function TutorialLetterImporter({ moduleId, onSaved }: { moduleId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [contents, setContents] = useState<File | null>(null)
  const [preview, setPreview] = useState<TutorialPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [reviewed, setReviewed] = useState(false)
  const [detail, setDetail] = useState<{ title: string; html: string; questions: RecreatedQuestion[] } | null>(null)
  const pause = useRef(false)
  async function post<T>(body: unknown): Promise<T> {
    const r = await fetch(`/api/admin/modules/${moduleId}/tutorial-letter`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || "Could not complete this step.")
    return data
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true); setError("")
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : "Could not complete this step.") }
    finally { setBusy(false); setMessage("") }
  }
  async function start() {
    if (!file) return
    await run(async () => {
      const source = await readPaperFile(file, setMessage)
      const toc = contents ? await readPaperFile(contents, setMessage) : undefined
      setMessage("Reading the study plan, verifying book contents and placing assessments…")
      setPreview(await post<TutorialPreview>({ action: "plan", source, contents: toc })); setReviewed(false); setDetail(null)
    })
  }
  async function generate() {
    if (!preview) return
    pause.current = false; setReviewed(false)
    await run(async () => {
      for (const [i, task] of preview.tasks.entries()) {
        if (pause.current) break
        if (task.complete) continue
        setMessage(`Drafting ${i + 1} of ${preview.tasks.length}: ${task.title}`)
        setPreview(await post<TutorialPreview>({ action: "draft", importId: preview.id, key: task.key }))
      }
    })
  }
  const ready = !!preview && preview.tasks.every(t => t.complete)
  return <>
    <Button size="sm" onClick={() => { setOpen(true); void run(async () => { const r = await fetch(`/api/admin/modules/${moduleId}/tutorial-letter`); const data = await r.json(); if (!r.ok) throw new Error(data.error); setPreview(data); setReviewed(false) }) }}><BookOpen className="h-4 w-4" />Upload tutorial letter</Button>
    <Modal open={open} onClose={() => { if (!busy) setOpen(false) }} size="xl" persistent={busy}>
      <ModalHeader onClose={busy ? undefined : () => setOpen(false)}><h2 className="text-lg font-semibold">Rebuild from a tutorial letter</h2></ModalHeader>
      <ModalBody className="space-y-4">
        <p className="text-sm text-muted-foreground">Use the prescribed book’s chapters and sections, write fresh lessons with {TUTORIAL_TOPIC_QUIZ_SIZE}-question topic quizzes, and add a student study guide. All drafts are saved so you can close and resume. Nothing changes for students until you review and replace.</p>
        {!preview && <>
          <label className="block text-sm font-medium" htmlFor="tutorial-letter">Tutorial letter PDF</label>
          <DocumentUpload id="tutorial-letter" accept=".pdf,application/pdf" files={file ? [file] : []} disabled={busy} onSelect={files => setFile(files[0] ?? null)} onRemove={() => setFile(null)} hint="PDF · Up to 10 MB and 100 pages" />
          <label className="block text-sm font-medium" htmlFor="tutorial-contents">Book contents pages (optional when already verified)</label>
          <DocumentUpload id="tutorial-contents" accept=".pdf,application/pdf" files={contents ? [contents] : []} disabled={busy} onSelect={files => setContents(files[0] ?? null)} onRemove={() => setContents(null)} hint="Upload the prescribed edition’s contents pages, not the full book. PDF · Up to 10 MB and 100 pages each." />
        </>}
        {preview?.applied && <p className="rounded-lg bg-muted p-4 font-medium">This tutorial letter has been applied. The new chapters, lessons and study guide are available to students.</p>}
        {preview && <>
          <details className="rounded-xl border p-4"><summary className="cursor-pointer font-medium">Review book, study schedule and assessment rules</summary><div className="mt-4"><TutorialGuideContent guide={preview.plan.guide} /></div></details>
          <div className="space-y-2">
            <h3 className="font-semibold">New chapter structure</h3>
            {preview.plan.chapters.map((c, ci) => {
              const completed = c.topics.filter((_, ti) => preview.tasks.some(t => t.key === `lesson-${ci}-${ti}` && t.complete)).length
              const total = c.topics.length
              const percentage = total ? Math.round(completed / total * 100) : 0
              const status = preview.applied ? "added" : "drafted"
              return <details key={c.ref} className="rounded-lg border p-3">
                <summary className="cursor-pointer font-medium">
                  {c.ref}. {c.title}
                  <span className="mt-2 flex items-center justify-between gap-3 text-xs font-normal text-muted-foreground">
                    <span>{completed} / {total} topics {status}</span>
                    <span>{percentage}%</span>
                  </span>
                  <span role="progressbar" aria-label={`${c.title}: topics ${status}`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed} aria-valuetext={`${completed} of ${total} topics ${status}`} className="mt-2 block h-2 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-foreground transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${percentage}%` }} />
                  </span>
                </summary>
                <ul className="mt-3 space-y-2 text-sm">
                  {c.topics.map((t, ti) => {
                    const complete = preview.tasks.some(task => task.key === `lesson-${ci}-${ti}` && task.complete)
                    return <li key={t.ref} className="flex items-start justify-between gap-3">
                      <span>{t.ref} {t.title}</span>
                      <span className={`shrink-0 text-xs ${complete ? "font-medium text-foreground" : "text-muted-foreground"}`}>{complete ? (preview.applied ? "Added" : "Ready") : "Pending"}</span>
                    </li>
                  })}
                </ul>
                {(preview.plan.retainedAssignments.length ? preview.plan.retainedAssignments : preview.plan.guide.assessments).filter(a => tutorialCheckpointIndex(preview.plan.chapters, a.chapterRefs) === ci).map(a => <p key={a.title} className="mt-3 rounded bg-muted p-2 text-sm">After this chapter: {a.title}{preview.plan.retainedAssignments.length ? " (retained upload)" : " (practice)"}</p>)}
              </details>
            })}
          </div>
          <p className="text-sm">{preview.tasks.filter(t => t.complete).length} / {preview.tasks.length} drafts complete. Each topic gets a lesson of approximately 2,500 readable characters and a {TUTORIAL_TOPIC_QUIZ_SIZE}-question quiz.</p>
          {preview.tasks.some(t => t.complete) && <details><summary className="cursor-pointer text-sm font-medium">Review drafted lessons and answer keys</summary><div className="mt-2 max-h-48 space-y-1 overflow-y-auto">{preview.tasks.filter(t => t.complete).map(t => <button key={t.key} disabled={busy} className="block text-left text-sm underline" onClick={() => void run(async () => { const d = await post<{ html: string; questions: RecreatedQuestion[] }>({ action: "detail", importId: preview.id, key: t.key }); setDetail({ ...d, title: t.title }) })}>{t.title}</button>)}</div></details>}
          {detail && <section className="rounded-lg border p-4"><h3 className="font-semibold">{detail.title}</h3><div className="prose prose-sm mt-3 max-w-none" dangerouslySetInnerHTML={{ __html: detail.html }} />{detail.questions.map((q, i) => <details key={i} className="mt-2"><summary className="cursor-pointer">{i + 1}. {q.question} ({q.marks} marks)</summary><div className="mt-2 whitespace-pre-line text-sm">{q.options.map(o => <p key={o}>{o === q.correctOption ? "✓ " : ""}{o}</p>)}{q.modelAnswer && <p>Model answer: {q.modelAnswer}</p>}{q.rubric?.map((r, j) => <p key={j}>{r.criterion} — {r.marks} marks</p>)}</div></details>)}</section>}
          {!preview.applied && ready && <label className="flex items-start gap-3 rounded-lg border border-amber-500/50 p-4 text-sm"><input type="checkbox" checked={reviewed} disabled={busy} onChange={e => setReviewed(e.target.checked)} className="mt-1" /><span>I reviewed the syllabus, lessons and assessments. Replace {preview.oldChapterCount} existing chapters and {preview.oldTopicCount} topics for all students. Old topic progress, attachments and exercises will leave the active syllabus; uploaded assignments and historical quiz answers are retained. Existing mock exam configuration will be cleared.</span></label>}
        </>}
        {message && <p role="status" className="text-sm">{message}</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </ModalBody>
      <ModalFooter>
        {busy && message.startsWith("Drafting") && <Button onClick={() => { pause.current = true; setMessage("Pausing after this draft…") }}>Pause after this draft</Button>}
        {!busy && preview && <Button onClick={() => {
          setFile(null); setContents(null)
          setPreview(null); setDetail(null); setReviewed(false)
          setMessage(""); setError(""); pause.current = false
        }}>Start a new import</Button>}
        {!preview && <Button variant="primary" disabled={busy || !file} onClick={() => void start()}>Review import plan</Button>}
        {preview && !preview.applied && !ready && <Button variant="primary" disabled={busy} onClick={() => void generate()}>{preview.tasks.some(t => t.complete) ? "Continue drafting" : "Generate lessons and assessments"}</Button>}
        {preview && !preview.applied && ready && <Button variant="primary" disabled={busy || !reviewed} onClick={() => void run(async () => { setMessage("Replacing the module…"); await post({ action: "apply", importId: preview.id, reviewed }); setPreview({ ...preview, applied: true }); onSaved() })}>Replace module content</Button>}
      </ModalFooter>
    </Modal>
  </>
}
