"use client"
import { queueGeneration, waitForGeneration } from "@/lib/generation-client"

import { DocumentUpload } from "@/components/ui/document-upload"
import { useState } from "react"
import { readPaperFile } from "./read-paper-file"
import { parsePaperSources, MAX_PAPER_FILES, MAX_PAPER_BYTES, type PaperSource } from "@/lib/module-recreation-input"
import Link from "next/link"
import { CheckCircle2, Loader2, RotateCcw, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LevelPicker } from "@/components/auth/level-picker"
import { HIGH_SCHOOL_GRADES, type StudyLevel } from "@/lib/levels"
import { cn } from "@/lib/utils"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "./modal"

/**
 * "Add with AI": type a subject's or module's name and the AI plans its
 * chapters and topics from the syllabus (CAPS for Grade 11/12 subjects, the
 * UNISA module for university modules), then writes each topic's lesson,
 * quiz and (for theory topics) flashcards, a few topics at a time. Everything
 * is saved as it goes, so stopping halfway keeps what's done.
 */

type Step = "form" | "planning" | "writing" | "done"
type TaskStatus = "waiting" | "working" | "done" | "failed"
interface Task {
  id: string
  title: string
  chapter: string
  theory: boolean
  status: TaskStatus
  note?: string
}

const FLASHCARDS = 10

export function ModuleBuilder({
  onAdded,
  defaultLevel = "highschool",
  defaultGrade = 12,
}: {
  onAdded: () => void
  defaultLevel?: StudyLevel
  /** Opened from a grade: that grade */
  defaultGrade?: number
}) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("form")
  const [level, setLevel] = useState<StudyLevel>(defaultLevel)
  const [name, setName] = useState("")
  const [grade, setGrade] = useState<number>(defaultGrade)
  const [files, setFiles] = useState<File[]>([])
  const [paperTypes, setPaperTypes] = useState<Record<number, "assignment" | "exam">>({})
  const [material, setMaterial] = useState<PaperSource[] | null>(null)
  const [reading, setReading] = useState("")
  const [notes, setNotes] = useState("")
  const [questions, setQuestions] = useState(20)
  const [flashcards, setFlashcards] = useState(true)
  const [error, setError] = useState("")
  const [existingId, setExistingId] = useState<string | null>(null)
  const [built, setBuilt] = useState<{ moduleId: string; title: string } | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const busy = step === "planning" || step === "writing"


  function close() {
    if (busy) return
    setOpen(false)
    setStep("form")
    setError("")
    setExistingId(null)
    setTasks([])
    setBuilt(null)
    setName("")
    setNotes("")
    setFiles([])
    setPaperTypes({})
    setMaterial(null)
    setReading("")
  }


  async function writeAll(list: Task[], documents = material, moduleId = built?.moduleId) {
    setStep("writing")
    const tasks = list.map(task => documents && moduleId
      ? { path: "/api/modules/build/topic", body: { moduleId, topicId: task.id, sources: documents }, label: task.title }
      : { path: "/api/admin/textbooks/generate-topic", body: { topicId: task.id, length: "standard", questionCount: questions, flashcards: flashcards && task.theory ? FLASHCARDS : 0, projects: task.theory ? 1 : 2 }, label: task.title })
    try {
      const id = await queueGeneration(tasks, "Module lessons and quizzes")
      await waitForGeneration(id)
      setTasks(previous => previous.map(t => list.some(item => item.id === t.id) ? { ...t, status: "done" } : t))
    } catch (error) { setError(error instanceof Error ? error.message : "Generation failed") }
    setStep("done")
    onAdded()
  }

  async function build(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) return setError(level === "highschool" ? "Type the subject's name" : "Type the module's name")
    setError("")
    setExistingId(null)
    setStep("planning")
    try {
      let documents: PaperSource[] | null = null
      if (files.length) {
        documents = []
        for (const [index, file] of files.entries()) {
          documents.push({ ...await readPaperFile(file, setReading), kind: paperTypes[index] ?? "assignment", format: "auto" })
          parsePaperSources(documents)
        }
        documents = parsePaperSources(documents)
        setMaterial(documents)
        setReading("Planning chapters, topics and assignment checkpoints from your documents…")
      }
      const jobId = await queueGeneration([{ path: "/api/modules/build", body: {
        level, name: name.trim(), grade: level === "highschool" ? grade : undefined,
        notes: notes.trim() || undefined, sources: documents ?? undefined,
      }, continueWith: "module-topics", options: { length: "standard", questionCount: questions, flashcards: flashcards ? FLASHCARDS : 0, projects: 1 } }], `Build ${name.trim()}`)
      const job = await waitForGeneration(jobId)
      const r = job.results[0].data as { moduleId: string; title: string; topics: Omit<Task, "status">[] }
      setBuilt({ moduleId: r.moduleId, title: r.title })
      onAdded()
      const list = r.topics.map(t => ({ ...t, status: "done" as const }))
      setTasks(list)
      setStep("done")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't plan it")
      const data = (err as { data?: { moduleId?: string } }).data
      if (data?.moduleId) setExistingId(data.moduleId)
      setStep("form")
    }
  }

  const done = tasks.filter(t => t.status === "done").length
  const failed = tasks.filter(t => t.status === "failed")
  const word = level === "highschool" ? "subject" : "module"

  return (
    <>
      <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
        <Sparkles className="h-4 w-4" />
        Build a module
      </Button>

      <Modal open={open} onClose={close} size="lg" persistent={busy}>
        <form onSubmit={build}>
          <ModalHeader onClose={busy ? undefined : close}>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="h-5 w-5" />
              {built ? built.title : "Build a subject or module"}
            </h2>
          </ModalHeader>

          <ModalBody className="space-y-5">
            {step === "form" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Upload documents to build chapters and topics from their content, with quizzes and cumulative assignment checkpoints after the relevant lessons. Without documents, the builder uses the syllabus for the name you enter.
                </p>
                <LevelPicker value={level} onChange={setLevel} name="build-level" />
                <div className={cn("grid gap-3", level === "highschool" && "sm:grid-cols-[1fr_9rem]")}>
                  <div>
                    <label htmlFor="build-name" className="mb-1.5 block text-sm font-medium">
                      {level === "highschool" ? "Subject name" : "Module code and name"}
                    </label>
                    <Input
                      id="build-name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      maxLength={150}
                      autoFocus
                      placeholder={level === "highschool" ? "e.g. Physical Sciences" : "e.g. COS1511 Introduction to Programming I"}
                    />
                  </div>
                  {level === "highschool" && (
                    <div>
                      <label htmlFor="build-grade" className="mb-1.5 block text-sm font-medium">Grade</label>
                      <select
                        id="build-grade"
                        value={grade}
                        onChange={e => setGrade(Number(e.target.value))}
                        className="neo-inset h-11 w-full rounded-full bg-transparent px-4 text-sm outline-none"
                      >
                        {HIGH_SCHOOL_GRADES.map(g => (
                          <option key={g} value={g}>
                            Grade {g}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="build-notes" className="mb-1.5 block text-sm font-medium">
                    Drafting instructions <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    id="build-notes"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    maxLength={1000}
                    placeholder={level === "highschool" ? "e.g. Paper 2 topics only" : "e.g. part of the BSc Computing"}
                  />
                </div>
                <div className="space-y-3">
                  <label htmlFor="build-documents" className="block text-sm font-medium">Source documents (optional)</label>
                  <DocumentUpload id="build-documents" accept="application/pdf,.pdf" multiple files={files} showFiles={false} hint="Up to 20 PDFs · 10 MB per file" buttonLabel={files.length ? "Replace documents" : "Choose documents"} onSelect={selected => {
                    if (selected.length > MAX_PAPER_FILES || selected.some(f => !/\.pdf$/i.test(f.name) || f.size > MAX_PAPER_BYTES)) { setError("Choose up to 20 PDFs, at most 10 MB each."); return }
                    setFiles(selected); setPaperTypes({}); setMaterial(null); setError("")
                  }} />
                  <p className="text-xs text-muted-foreground">Up to 20 PDFs, 10 MB each. Assignments determine quiz format; previous exams inform lessons. No mock exam is created here. If format detection fails, recognizable choices produce MCQs, document-submission instructions produce written questions, otherwise lessons are created on their own.</p>
                  {files.map((file, i) => <div key={`${file.name}:${i}`} className="flex items-center justify-between gap-2 text-sm"><span>{file.name}</span><select aria-label={`Document type for ${file.name}`} value={paperTypes[i] ?? "assignment"} onChange={e => setPaperTypes(prev => ({ ...prev, [i]: e.target.value as "assignment" | "exam" }))} className="rounded-lg border p-2"><option value="assignment">Assignment / study material</option><option value="exam">Previous exam</option></select></div>)}
                  {!!files.length && <p className="text-sm">The document format determines assessment types and question counts. Written assessments accept photos and PDFs. Review the generated content before sharing it with students.</p>}
                </div>
                {!files.length && <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  <label className="flex items-center gap-2">
                    Questions per topic
                    <select value={questions} onChange={e => setQuestions(Number(e.target.value))} className="rounded-full border border-border bg-white px-3 py-1.5">
                      {[5, 10, 15, 20].map(n => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-black" checked={flashcards} onChange={e => setFlashcards(e.target.checked)} />
                    Flashcards for theory topics
                  </label>
                </div>}
                {error && (
                  <p className="text-sm text-red-600" role="alert">
                    {error}{" "}
                    {existingId && (
                      <Link href={`/admin/modules/${existingId}`} className="font-medium underline">
                        Open it
                      </Link>
                    )}
                  </p>
                )}
              </>
            )}

            {step === "planning" && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" />
                {reading || `Planning chapters and topics from the ${level === "highschool" ? `Grade ${grade} CAPS syllabus` : "module syllabus"}…`}
              </p>
            )}

            {(step === "writing" || step === "done") && (
              <>
                <p className="text-sm" role="status">
                  {step === "writing"
                    ? `Writing lessons and quizzes: ${done} of ${tasks.length} topics done. You can leave or close the app; progress is saved.`
                    : failed.length
                      ? `${done} of ${tasks.length} topics written. ${failed.length} failed: try them again.`
                      : tasks.some(t => t.status !== "done") ? `${done} of ${tasks.length} topics written. Continue when ready.` : `All ${tasks.length} topics processed. Review the lessons and assessments in the ${word}.`}
                </p>
                <ul className="max-h-[22rem] space-y-1 overflow-y-auto text-sm">
                  {tasks.map(t => (
                    <li key={t.id} className="flex items-start gap-2">
                      <span className="mt-0.5 w-4 shrink-0">
                        {t.status === "working" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : t.status === "done" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : t.status === "failed" ? (
                          <X className="h-4 w-4 text-red-600" />
                        ) : (
                          <span className="text-muted-foreground">·</span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-muted-foreground">{t.chapter}</span> {t.title}
                        {t.note && <span className={cn("block text-xs", t.status === "failed" ? "text-red-600" : "text-muted-foreground")}>{t.note}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </ModalBody>

          <ModalFooter>
            {step === "form" && (
              <>
                <Button type="button" variant="ghost" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={name.trim().length < 2}>
                  <Sparkles className="h-4 w-4" />
                  Plan and write
                </Button>
              </>
            )}
            {(step === "writing" || step === "planning") && <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Continue in background</Button>}
            {step === "done" && (
              <>
                {tasks.some(t => t.status !== "done") && (
                  <Button type="button" variant="default" onClick={() => void writeAll(tasks.filter(t => t.status !== "done"))}>
                    <RotateCcw className="h-4 w-4" />
                    {failed.length ? `Retry ${tasks.filter(t => t.status !== "done").length}` : "Carry on"}
                  </Button>
                )}
                {built && (
                  <Link
                    href={`/admin/modules/${built.moduleId}`}
                    className="inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background"
                  >
                    Open the {word}
                  </Link>
                )}
                <Button type="button" variant="ghost" onClick={close}>
                  Close
                </Button>
              </>
            )}
          </ModalFooter>
        </form>
      </Modal>
    </>
  )
}
