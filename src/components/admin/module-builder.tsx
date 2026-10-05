"use client"

import { useEffect, useRef, useState } from "react"
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

const CONCURRENCY = 3
const FLASHCARDS = 10

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw Object.assign(new Error(data.error ?? `Request failed (${res.status})`), { data })
  return data
}

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
  const [notes, setNotes] = useState("")
  const [questions, setQuestions] = useState(20)
  const [flashcards, setFlashcards] = useState(true)
  const [error, setError] = useState("")
  const [existingId, setExistingId] = useState<string | null>(null)
  const [built, setBuilt] = useState<{ moduleId: string; title: string } | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const stop = useRef(false)
  const [stopping, setStopping] = useState(false)
  const busy = step === "planning" || step === "writing"

  useEffect(() => {
    if (!busy) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [busy])

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
  }

  const setTask = (id: string, patch: Partial<Task>) => setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)))

  async function writeAll(list: Task[]) {
    setStep("writing")
    stop.current = false
    setStopping(false)
    const queue = [...list]
    const worker = async () => {
      while (queue.length && !stop.current) {
        const task = queue.shift()!
        setTask(task.id, { status: "working", note: undefined })
        try {
          const r = await postJson<{ wroteLesson: boolean; questionsAdded: number; flashcardsAdded?: number; exercisesAdded?: number }>(
            "/api/admin/textbooks/generate-topic",
            { topicId: task.id, length: "standard", questionCount: questions, flashcards: flashcards && task.theory ? FLASHCARDS : 0, projects: task.theory ? 1 : 2 }
          )
          const parts = [
            r.wroteLesson ? "lesson" : "",
            r.questionsAdded ? `${r.questionsAdded} questions` : "",
            r.flashcardsAdded ? `${r.flashcardsAdded} flashcards` : "",
            r.exercisesAdded ? `${r.exercisesAdded} exercises` : "",
          ].filter(Boolean)
          setTask(task.id, { status: "done", note: parts.join(" · ") || "already done" })
        } catch (err) {
          setTask(task.id, { status: "failed", note: err instanceof Error ? err.message : "Failed" })
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
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
      const r = await postJson<{ moduleId: string; title: string; topics: Omit<Task, "status">[] }>("/api/modules/build", {
        level,
        name: name.trim(),
        grade: level === "highschool" ? grade : undefined,
        notes: notes.trim() || undefined,
      })
      setBuilt({ moduleId: r.moduleId, title: r.title })
      onAdded()
      const list = r.topics.map(t => ({ ...t, status: "waiting" as const }))
      setTasks(list)
      await writeAll(list)
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
        Add with AI
      </Button>

      <Modal open={open} onClose={close} size="lg" persistent={busy}>
        <form onSubmit={build}>
          <ModalHeader onClose={busy ? undefined : close}>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="h-5 w-5" />
              {built ? built.title : "Add a subject or module with AI"}
            </h2>
          </ModalHeader>

          <ModalBody className="space-y-5">
            {step === "form" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Type the name and the AI plans the chapters and topics from the syllabus (CAPS for high school subjects, the
                  UNISA module for university modules), then writes each topic&apos;s lesson and quiz.
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
                    Notes for the AI <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    id="build-notes"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    maxLength={1000}
                    placeholder={level === "highschool" ? "e.g. Paper 2 topics only" : "e.g. part of the BSc Computing"}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
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
                </div>
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
                Planning the chapters and topics from the {level === "highschool" ? `Grade ${grade} CAPS syllabus` : "module's syllabus"}…
              </p>
            )}

            {(step === "writing" || step === "done") && (
              <>
                <p className="text-sm" role="status">
                  {step === "writing"
                    ? `Writing lessons and quizzes: ${done} of ${tasks.length} topics done. Keep this window open; it takes a while.`
                    : failed.length
                      ? `${done} of ${tasks.length} topics written. ${failed.length} failed: try them again.`
                      : `All ${tasks.length} topics written. Students can join the ${word} now.`}
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
            {step === "writing" && (
              <Button
                type="button"
                variant="ghost"
                disabled={stopping}
                onClick={() => {
                  stop.current = true
                  setStopping(true)
                }}
              >
                {stopping ? "Stopping after the current topics…" : "Stop"}
              </Button>
            )}
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
