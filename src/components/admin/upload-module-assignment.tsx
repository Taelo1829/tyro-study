"use client"
import { DocumentUpload } from "@/components/ui/document-upload"
import { useState } from "react"
import Link from "next/link"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal, ModalBody, ModalHeader, ModalFooter } from "./modal"
import { readPaperFile } from "./read-paper-file"
import type { PaperSource, RecreatedQuestion, LessonReplacement } from "@/lib/module-recreation-input"

type LessonDraft = LessonReplacement & { title: string }
type Draft = { warnings?: string[]; title: string; matches: { topicId: string; evidence: string }[]; questions: RecreatedQuestion[]; placement: { afterChapterId: string; chapters: { id: string; title: string }[] } }
export function UploadModuleAssignment({ moduleId, onSaved }: { moduleId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [source, setSource] = useState<PaperSource | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [lessons, setLessons] = useState<LessonDraft[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [reviewed, setReviewed] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  async function post<T>(body: unknown): Promise<T> {
    const response = await fetch(`/api/admin/modules/${moduleId}/assignments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error ?? "Could not add this assignment.")
    return data
  }
  const topicIds = [...new Set(draft?.matches.map(m => m.topicId) ?? [])]
  const lessonsReady = topicIds.length > 0 && topicIds.every(id => lessons.some(l => l.topicId === id))
  async function draftLessons(paper: PaperSource, assignment: Draft, completed: LessonDraft[]) {
    const ids = [...new Set(assignment.matches.map(m => m.topicId))]
    for (let i = 0; i < ids.length; i++) {
      if (completed.some(l => l.topicId === ids[i])) continue
      setMessage(`Updating targeted lesson ${i + 1} of ${ids.length}…`)
      const lesson = await post<LessonDraft>({ action: "lesson", source: paper, matches: assignment.matches, topicId: ids[i] })
      setLessons(previous => [...previous.filter(l => l.topicId !== lesson.topicId), lesson])
    }
  }
  async function retryLessons() {
    if (!source || !draft) return
    setBusy(true); setError(""); setReviewed(false)
    try { await draftLessons(source, draft, lessons) }
    catch (err) { setError(err instanceof Error ? err.message : "Could not update this lesson. Retry to continue; completed lessons are kept.") }
    finally { setBusy(false); setMessage("") }
  }
  async function prepare() {
    if (!file) return
    setBusy(true); setError("")
    try {
      const paper = await readPaperFile(file, setMessage)
      setSource(paper)
      setMessage("Matching the assignment to this module’s chapters and extracting its quiz questions…")
      const result = await post<Draft>({ action: "draft", source: paper })
      setDraft(result); setReviewed(false); setLessons([])
      await draftLessons(paper, result, [])
    } catch (err) { setError(err instanceof Error ? err.message : "Could not read this assignment.") }
    finally { setBusy(false); setMessage("") }
  }
  async function save() {
    if (!source || !draft || !reviewed || !lessonsReady) return
    setBusy(true); setError("")
    try {
      const result = await post<{ topicId: string }>({ action: "save", source, ...draft, lessons })
      setSavedId(result.topicId); onSaved()
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save this assignment.") }
    finally { setBusy(false) }
  }
  function close() { if (!busy) setOpen(false) }
  return <>
    <Button size="sm" onClick={() => { setOpen(true); if (savedId) { setSavedId(null); setLessons([]); setDraft(null); setSource(null); setFile(null); setReviewed(false) } }}><Upload className="h-4 w-4" />Upload assignment</Button>
    <Modal open={open} onClose={close} size="lg" persistent={busy}>
      <ModalHeader onClose={busy ? undefined : close}><h2 className="text-lg font-semibold">Create a quiz from an assignment</h2></ModalHeader>
      <ModalBody className="space-y-4">
        <p className="text-sm text-muted-foreground">Upload the assignment PDF. It will be added for all students after the last chapter it covers, as a quiz using its original questions. The lessons for its targeted topics will also be updated to teach the assessed skills. Review the revised lessons and quiz before saving for all students.</p>
        {!draft && !savedId && <div className="space-y-2"><label htmlFor="module-assignment-file" className="block text-sm font-medium">Assignment PDF (up to 10 MB)</label><DocumentUpload id="module-assignment-file" accept="application/pdf,.pdf" disabled={busy} files={file ? [file] : []} hint="PDF document · Up to 10 MB" onSelect={selected => { setFile(selected[0] ?? null); setError("") }} onRemove={() => setFile(null)} /></div>}
        {draft && !savedId && <>
          <label className="block text-sm font-medium" htmlFor="uploaded-assignment-title">Assignment title</label>
          <Input id="uploaded-assignment-title" maxLength={150} value={draft.title} disabled={busy} onChange={e => setDraft({ ...draft, title: e.target.value })} />
          <div className="rounded-xl bg-muted p-4 text-sm"><p className="font-semibold">Place after: {draft.placement.chapters.at(-1)?.title}</p><p className="mt-1">Related chapters: {draft.placement.chapters.map(c => c.title).join(", ")}</p><p className="mt-1">{draft.questions.length} quiz questions · {draft.questions.reduce((n, q) => n + (q.marks ?? 1), 0)} marks</p></div>
          {draft.warnings?.map(warning => <p key={warning} role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{warning}</p>)}
          <details open><summary className="cursor-pointer font-medium">Review the extracted assignment</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border p-3 text-sm font-sans">{source?.text}</pre></details>
          <details><summary className="cursor-pointer font-medium">Review chapter matches</summary><ul className="mt-2 space-y-2 text-sm">{draft.matches.map((m, i) => <li key={i}>{m.evidence}</li>)}</ul></details>
          <details open><summary className="cursor-pointer font-medium">Review quiz questions and answers</summary><ol className="mt-3 space-y-4">{draft.questions.map((q, i) => <li key={i} className="rounded-xl border p-3 text-sm"><p className="whitespace-pre-wrap font-medium">{i + 1}. {q.question}</p><p>{q.kind === "written" ? "Written" : "Multiple choice"} · {q.marks} marks</p>{q.options.map((option, j) => <p key={j}>{String.fromCharCode(65 + j)}. {option}{option === q.correctOption ? " ✓" : ""}</p>)}{q.kind === "written" && <details><summary>Private marking guide</summary><p className="whitespace-pre-wrap">{q.modelAnswer}</p>{q.rubric?.map((r, j) => <p key={j}>{r.criterion}: {r.marks}</p>)}</details>}</li>)}</ol></details>
          <section className="space-y-3">
            <h3 className="font-semibold">Updated topic lessons ({lessons.length}/{topicIds.length})</h3>
            <p className="text-sm text-muted-foreground">Each preview replaces the current lesson with a cohesive rewrite of approximately 2,500 characters, weaving the assessed skills into its explanations and examples. Existing topic quizzes are kept.</p>
            {lessons.map(lesson => <details key={lesson.topicId} className="rounded-xl border p-3"><summary className="cursor-pointer font-medium">{lesson.title}</summary><div className="prose mt-3 max-w-none text-sm" dangerouslySetInnerHTML={{ __html: lesson.html }} /></details>)}
            {!lessonsReady && !busy && <Button variant="outline" onClick={() => void retryLessons()}>Retry remaining lesson updates</Button>}
          </section>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} disabled={busy || !lessonsReady} onChange={e => setReviewed(e.target.checked)} />All original questions and options are included, the answers and chapter placement are correct, and I have reviewed the updated topic lessons.</label>
        </>}
        {savedId && <p role="status">Assignment quiz saved and targeted lessons updated. <Link href={`/modules/${moduleId}/topics/${savedId}`} className="underline">View the quiz</Link></p>}
        {busy && <p role="status" className="text-sm">{message || "Saving assignment…"}</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" disabled={busy} onClick={close}>Close</Button>
        {draft && !savedId && <Button disabled={busy} variant="ghost" onClick={() => { setDraft(null); setLessons([]); setReviewed(false) }}>Choose another file</Button>}
        {!draft && !savedId && <Button disabled={busy || !file} onClick={() => void prepare()}>Match chapters</Button>}
        {draft && !savedId && <Button disabled={busy || !reviewed || !lessonsReady || !draft.title.trim()} onClick={() => void save()}>Save quiz and lesson updates</Button>}
      </ModalFooter>
    </Modal>
  </>
}
