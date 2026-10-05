"use client"

import { useEffect, useRef, useState } from "react"
import { AlertCircle, Check, CheckCircle2, Link2, Loader2, Plus, RotateCcw, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "./modal"

/**
 * "Build with AI" for a course:
 *
 * 1. Find the course's modules on its UNISA qualification page (or let the AI
 *    suggest them from the course name).
 * 2. The admin ticks the modules to add. Modules Tyro already has are just
 *    added to the course; their content is left alone.
 * 3. Each new module is created with AI-planned chapters and topics, then each
 *    topic gets a lesson, a quiz and (for theory topics) flashcards, a few at
 *    a time, with progress shown. Everything is saved as it goes, so stopping
 *    halfway keeps what's done.
 */

interface FoundModule {
  code: string
  title: string
  year: number
  group: "compulsory" | "elective"
  url: string | null
  existingModuleId: string | null
  existingTitle: string | null
  inCourse: boolean
}

interface Row extends FoundModule {
  include: boolean
}

/** Where a module is in its own setup; its topics' progress comes from the topic tasks */
type ModulePhase = "waiting" | "planning" | "planned" | "planFailed"
interface ModuleJob {
  code: string
  title: string
  year: number
  url: string | null
  phase: ModulePhase
  /** Already in Tyro: only added to the course */
  linkedOnly?: boolean
  /** Why planning failed */
  note?: string
}

type ModuleStatus = "waiting" | "planning" | "writing" | "done" | "failed"

type TopicStatus = "waiting" | "working" | "done" | "failed"
interface TopicTask {
  topicId: string
  code: string
  number: string
  title: string
  theory: boolean
  status: TopicStatus
  note?: string
}

type Step = "find" | "finding" | "review" | "building" | "done"
type Length = "short" | "standard" | "detailed"

const TOPIC_CONCURRENCY = 3
const FLASHCARDS_PER_THEORY_TOPIC = 10

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export function CourseImport({
  course,
  open,
  onClose,
  onChanged,
  onChooseManually,
}: {
  course: { id: string; title: string }
  open: boolean
  onClose: () => void
  /** Modules were added to the course (reload the list) */
  onChanged: () => void
  /** "Choose modules myself" instead */
  onChooseManually?: () => void
}) {
  const [step, setStep] = useState<Step>("find")
  const [error, setError] = useState("")
  const [url, setUrl] = useState("")
  const [qualification, setQualification] = useState("")
  const [source, setSource] = useState<"page" | "ai">("page")
  const [rows, setRows] = useState<Row[]>([])
  const [foundCount, setFoundCount] = useState(0)
  const [newCode, setNewCode] = useState("")
  const [newTitle, setNewTitle] = useState("")

  const [length, setLength] = useState<Length>("standard")
  const [questionCount, setQuestionCount] = useState(20)
  const [flashcards, setFlashcards] = useState(true)
  const [videos, setVideos] = useState(false)

  const [jobs, setJobs] = useState<ModuleJob[]>([])
  const [tasks, setTasks] = useState<TopicTask[]>([])
  const stopRef = useRef(false)
  const [stopping, setStopping] = useState(false)
  const busy = step === "finding" || step === "building"

  // Leaving the page mid-build stops it: warn first
  useEffect(() => {
    if (step !== "building") return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [step])

  function close() {
    if (busy) return
    setStep("find")
    setError("")
    setRows([])
    setJobs([])
    setTasks([])
    onClose()
  }

  async function find(withLink: boolean) {
    setError("")
    setStep("finding")
    try {
      const r = await postJson<{ qualification: string; source: "page" | "ai"; modules: FoundModule[] }>(
        `/api/courses/${course.id}/discover`,
        { url: withLink ? url.trim() : null }
      )
      setQualification(r.qualification)
      setSource(r.source)
      setFoundCount(r.modules.length)
      // Compulsory modules start ticked; electives are the admin's choice
      setRows(r.modules.map(m => ({ ...m, include: !m.inCourse && m.group === "compulsory" })))
      setStep("review")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't find the modules")
      setStep("find")
    }
  }

  function addManual() {
    const code = newCode.replace(/\s+/g, "").toUpperCase()
    if (!/^[A-Z]{3,4}\d{4}$/.test(code)) {
      setError("Module codes look like COS1511.")
      return
    }
    if (!newTitle.trim()) {
      setError("Give the module's name too.")
      return
    }
    if (rows.some(r => r.code === code)) {
      setError(`${code} is already in the list.`)
      return
    }
    setError("")
    setRows(prev => [
      ...prev,
      {
        code,
        title: newTitle.trim(),
        year: Number(code.match(/\d/)![0]) || 1,
        group: "compulsory",
        url: null,
        existingModuleId: null,
        existingTitle: null,
        inCourse: false,
        include: true,
      },
    ])
    setNewCode("")
    setNewTitle("")
  }

  const chosen = rows.filter(r => r.include && !r.inCourse)
  const newOnes = chosen.filter(r => !r.existingModuleId).length
  const linkOnly = chosen.length - newOnes

  async function writeTopic(task: TopicTask, setTask: (id: string, patch: Partial<TopicTask>) => void) {
    setTask(task.topicId, { status: "working" })
    try {
      const r = await postJson<{
        wroteLesson: boolean
        questionsAdded: number
        flashcardsAdded?: number
        projectsAdded?: number
        videoTitle?: string | null
        videoNote?: string | null
      }>("/api/admin/textbooks/generate-topic", {
        topicId: task.topicId,
        length,
        questionCount,
        video: videos,
        flashcards: flashcards && task.theory ? FLASHCARDS_PER_THEORY_TOPIC : 0,
        // Coding modules only (the server checks): fewer projects on theory topics
        projects: task.theory ? 1 : 2,
      })
      const parts = [
        r.wroteLesson ? "lesson" : "",
        r.questionsAdded ? `${r.questionsAdded} questions` : "",
        r.flashcardsAdded ? `${r.flashcardsAdded} flashcards` : "",
        r.projectsAdded ? `${r.projectsAdded} coding projects` : "",
        r.videoTitle ? "video" : "",
      ]
      setTask(task.topicId, { status: "done", note: parts.filter(Boolean).join(" · ") || "already done" })
      return true
    } catch (err) {
      setTask(task.topicId, { status: "failed", note: err instanceof Error ? err.message : "Failed" })
      return false
    }
  }

  const setJob = (code: string, patch: Partial<ModuleJob>) =>
    setJobs(prev => prev.map(j => (j.code === code ? { ...j, ...patch } : j)))
  const setTask = (id: string, patch: Partial<TopicTask>) =>
    setTasks(prev => prev.map(t => (t.topicId === id ? { ...t, ...patch } : t)))

  /**
   * Plans `toPlan` one after another (creating each module with its chapters
   * and topics) while topics are written a few at a time: the new modules'
   * topics plus `toWrite` (topics to try again).
   */
  async function run(toPlan: ModuleJob[], toWrite: TopicTask[]) {
    stopRef.current = false
    setStopping(false)
    setError("")
    setStep("building")

    const queue: TopicTask[] = [...toWrite]
    for (const t of toWrite) setTask(t.topicId, { status: "waiting", note: undefined })
    let planning = true

    const worker = async () => {
      while (!stopRef.current) {
        const task = queue.shift()
        if (!task) {
          if (!planning) return
          await sleep(400)
          continue
        }
        await writeTopic(task, setTask)
      }
    }
    const workers = Array.from({ length: TOPIC_CONCURRENCY }, worker)

    for (const m of toPlan) {
      if (stopRef.current) break
      setJob(m.code, { phase: "planning", note: undefined })
      try {
        const r = await postJson<{ created: boolean; topics: { id: string; title: string; theory: boolean; chapter: string }[] }>(
          `/api/courses/${course.id}/import-module`,
          { code: m.code, title: m.title, year: m.year, url: m.url }
        )
        onChanged()
        const newTasks: TopicTask[] = r.topics.map(t => ({
          topicId: t.id,
          code: m.code,
          number: t.chapter,
          title: t.title,
          theory: t.theory,
          status: "waiting",
        }))
        setTasks(prev => [...prev.filter(t => t.code !== m.code), ...newTasks])
        setJob(m.code, { phase: "planned", linkedOnly: !r.created })
        queue.push(...newTasks)
      } catch (err) {
        setJob(m.code, { phase: "planFailed", note: err instanceof Error ? err.message : "Couldn't add it" })
      }
    }
    planning = false
    await Promise.all(workers)

    // Stopped part-way: topics that never started count as left to do
    setTasks(prev => prev.map(t => (t.status === "waiting" || t.status === "working" ? { ...t, status: "failed", note: "stopped" } : t)))
    setJobs(prev => prev.map(j => (j.phase === "planning" ? { ...j, phase: "waiting" } : j)))
    onChanged()
    setStep("done")
  }

  function build() {
    const list: ModuleJob[] = chosen.map(m => ({ code: m.code, title: m.title, year: m.year, url: m.url, phase: "waiting" }))
    setJobs(list)
    setTasks([])
    return run(list, [])
  }

  /** Try one module again: plan it again if that failed, otherwise rewrite its unfinished topics */
  function retryModule(code: string) {
    const job = jobs.find(j => j.code === code)
    if (!job) return
    if (job.phase !== "planned") return run([job], [])
    return run([], tasks.filter(t => t.code === code && t.status !== "done"))
  }

  /** Every module that failed or never started, and every unfinished topic */
  function retryAll() {
    return run(
      jobs.filter(j => j.phase !== "planned"),
      tasks.filter(t => t.status !== "done")
    )
  }

  /** A module's status, worked out from its phase and its topics */
  function statusOf(j: ModuleJob): { status: ModuleStatus; total: number; done: number; failed: number } {
    const mine = tasks.filter(t => t.code === j.code)
    const done = mine.filter(t => t.status === "done").length
    const failed = mine.filter(t => t.status === "failed").length
    const base = { total: mine.length, done, failed }
    if (j.phase === "waiting") return { ...base, status: "waiting" }
    if (j.phase === "planning") return { ...base, status: "planning" }
    if (j.phase === "planFailed") return { ...base, status: "failed" }
    if (mine.some(t => t.status === "waiting" || t.status === "working")) return { ...base, status: "writing" }
    return { ...base, status: failed ? "failed" : "done" }
  }

  const topicsDone = tasks.filter(t => t.status === "done").length
  const unfinished = tasks.filter(t => t.status !== "done").length
  const planned = jobs.filter(j => j.phase === "planned" || j.phase === "planFailed").length
  const notStarted = jobs.filter(j => j.phase === "waiting").length
  const failedModules = jobs.filter(j => j.phase === "planFailed").length
  const retryable = failedModules + notStarted + unfinished > 0
  const years = [...new Set(rows.map(r => r.year))].sort()

  const select = "rounded-full border border-border bg-white px-3 py-1.5 text-sm"

  return (
    <Modal open={open} onClose={close} size="lg" persistent={busy}>
      <ModalHeader onClose={busy ? undefined : close}>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5" />
          Build {course.title} with AI
        </h2>
      </ModalHeader>

      <ModalBody className="space-y-5">
        {(step === "find" || step === "finding") && (
          <>
            <p className="text-sm text-muted-foreground">
              Paste the course&apos;s page from the UNISA website (the qualification page that lists its modules). The AI reads
              the modules from it, you choose which to add, and it builds each new module: chapters, topics, lessons,
              quizzes, and flashcards for theory topics.
            </p>
            <div>
              <label htmlFor="qual-url" className="mb-1.5 block text-sm font-medium">
                UNISA qualification page
              </label>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="qual-url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  disabled={step === "finding"}
                  placeholder="https://www.unisa.ac.za/…/Bachelor-of-Science-in-Computing-(98906-…)"
                  className="pl-11"
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Find it on unisa.ac.za under Register to study › Find your qualification.
              </p>
            </div>
            {step === "finding" ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Finding the modules…
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" onClick={() => find(true)} disabled={!url.trim()}>
                  <Sparkles className="h-4 w-4" />
                  Find modules
                </Button>
                <Button variant="ghost" onClick={() => find(false)}>
                  No link? Suggest from the course name
                </Button>
                {onChooseManually && (
                  <button type="button" onClick={onChooseManually} className="text-sm text-muted-foreground underline-offset-2 hover:underline">
                    Choose existing modules myself
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {step === "review" && (
          <>
            <div>
              <p className="font-medium">{qualification}</p>
              {source === "ai" ? (
                <p className="mt-1 flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  Suggested by the AI from the course name, not read from UNISA. Check the codes against the UNISA website before
                  building.
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  {foundCount} modules found on the UNISA page. Compulsory modules are ticked; tick the electives you want.
                </p>
              )}
            </div>

            {years.map(year => (
              <section key={year}>
                <h3 className="mb-2 text-sm font-semibold">Year {year}</h3>
                <ul className="space-y-1.5">
                  {rows
                    .filter(r => r.year === year)
                    .map(r => (
                      <li key={r.code}>
                        <label
                          className={cn(
                            "flex items-start gap-3 rounded-2xl border px-4 py-2.5 text-sm",
                            r.inCourse ? "border-dashed border-border opacity-60" : "cursor-pointer border-border hover:border-foreground"
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-black"
                            checked={r.include && !r.inCourse}
                            disabled={r.inCourse}
                            onChange={e => setRows(prev => prev.map(x => (x.code === r.code ? { ...x, include: e.target.checked } : x)))}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-medium">{r.code}</span> {r.title}
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {r.group === "elective" ? "Elective" : "Compulsory"}
                              {" · "}
                              {r.inCourse
                                ? "already in this course"
                                : r.existingModuleId
                                  ? "already in Tyro: added to the course as it is"
                                  : "new: the AI builds it"}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                </ul>
              </section>
            ))}

            <section>
              <h3 className="mb-2 text-sm font-semibold">Add a missing module</h3>
              <div className="flex flex-wrap gap-2">
                <Input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="Code, e.g. COS2611" className="w-40" aria-label="Module code" />
                <Input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Name, e.g. Programming: Data Structures"
                  className="min-w-0 flex-1"
                  aria-label="Module name"
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addManual()
                    }
                  }}
                />
                <Button type="button" onClick={addManual}>
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </section>

            <section className="space-y-3 rounded-2xl bg-muted/50 p-4 text-sm">
              <h3 className="font-semibold">For each new module</h3>
              <div className="flex flex-wrap gap-x-5 gap-y-3">
                <label className="flex items-center gap-2">
                  Lessons
                  <select value={length} onChange={e => setLength(e.target.value as Length)} className={select}>
                    <option value="short">Short</option>
                    <option value="standard">Standard</option>
                    <option value="detailed">Detailed</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  Quiz questions per topic
                  <select value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))} className={select}>
                    {[0, 5, 10, 15, 20].map(n => (
                      <option key={n} value={n}>
                        {n === 0 ? "None" : n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 accent-black" checked={flashcards} onChange={e => setFlashcards(e.target.checked)} />
                  Flashcards for theory topics
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 accent-black" checked={videos} onChange={e => setVideos(e.target.checked)} />
                  Find a YouTube video per topic
                </label>
              </div>
              {newOnes > 0 && (
                <p className="text-muted-foreground">
                  Each new module gets about 20 to 40 topics, and each topic takes about half a minute, so {newOnes} new module
                  {newOnes !== 1 ? "s" : ""} take{newOnes === 1 ? "s" : ""} roughly {Math.max(5, Math.round((newOnes * 30 * 30) / TOPIC_CONCURRENCY / 60))} minutes.
                  Keep this window open while it works. Everything is saved as it goes.
                </p>
              )}
            </section>
          </>
        )}

        {(step === "building" || step === "done") && (
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">
                  {step === "building"
                    ? stopping
                      ? "Stopping after the current topics…"
                      : `Building: ${planned} of ${jobs.length} modules planned`
                    : retryable
                      ? `Finished with problems: ${[
                          failedModules ? `${failedModules} module${failedModules !== 1 ? "s" : ""} failed` : "",
                          unfinished ? `${unfinished} topic${unfinished !== 1 ? "s" : ""} left` : "",
                          notStarted ? `${notStarted} module${notStarted !== 1 ? "s" : ""} not started` : "",
                        ].filter(Boolean).join(", ")}. Use Retry.`
                      : "All done"}
                </span>
                <span className="text-muted-foreground">
                  {topicsDone} of {tasks.length} topics
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${tasks.length ? Math.round((topicsDone / tasks.length) * 100) : 0}%` }}
                />
              </div>
              {step === "building" && (
                <p className="mt-1.5 text-xs text-muted-foreground">Keep this window open. Everything is saved as it goes.</p>
              )}
            </div>

            <ul className="space-y-1.5">
              {jobs.map(j => {
                const { status, total, done, failed } = statusOf(j)
                const canRetry = step === "done" && (status === "failed" || status === "waiting")
                return (
                  <li key={j.code} className="flex items-start gap-3 rounded-2xl border border-border px-4 py-2.5 text-sm">
                    <span className="mt-0.5 shrink-0">
                      {status === "done" && <CheckCircle2 className="h-4 w-4 text-green-700" />}
                      {status === "failed" && <AlertCircle className="h-4 w-4 text-red-600" />}
                      {(status === "planning" || status === "writing") && <Loader2 className="h-4 w-4 animate-spin" />}
                      {status === "waiting" && <span className="block h-4 w-4 rounded-full border border-border" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{j.code}</span> {j.title}
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {status === "waiting" && (step === "done" ? "Not started" : "Waiting")}
                        {status === "planning" && "Planning chapters and topics…"}
                        {status === "writing" && `Writing topics: ${done + failed} of ${total}`}
                        {status === "done" && (j.linkedOnly ? "Already in Tyro: added to the course" : `${done} of ${total} topics written`)}
                        {status === "failed" &&
                          (j.phase === "planFailed"
                            ? `Couldn't be created: ${j.note ?? "unknown error"}`
                            : `${done} of ${total} topics written · ${failed} failed or not finished`)}
                      </span>
                    </span>
                    {canRetry && (
                      <Button size="sm" onClick={() => void retryModule(j.code)} aria-label={`Retry ${j.code}`} className="shrink-0">
                        <RotateCcw className="h-4 w-4" />
                        {status === "waiting" ? "Start" : "Retry"}
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>

            {tasks.some(t => t.status === "failed") && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">Topics that failed</summary>
                <ul className="mt-2 space-y-1">
                  {tasks
                    .filter(t => t.status === "failed")
                    .map(t => (
                      <li key={t.topicId} className="flex gap-2">
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                        <span>
                          {t.code} {t.number} {t.title}: <span className="text-muted-foreground">{t.note}</span>
                        </span>
                      </li>
                    ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {error && (
          <p className="flex items-start gap-2 text-sm text-red-600" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
      </ModalBody>

      {step === "review" && (
        <ModalFooter align="between">
          <Button variant="ghost" onClick={() => setStep("find")}>
            Back
          </Button>
          <Button variant="primary" onClick={build} disabled={chosen.length === 0}>
            <Sparkles className="h-4 w-4" />
            {newOnes > 0
              ? `Build ${newOnes} new module${newOnes !== 1 ? "s" : ""}${linkOnly ? ` and add ${linkOnly}` : ""}`
              : `Add ${linkOnly} module${linkOnly !== 1 ? "s" : ""}`}
          </Button>
        </ModalFooter>
      )}
      {step === "building" && (
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              stopRef.current = true
              setStopping(true)
            }}
          >
            Stop
          </Button>
        </ModalFooter>
      )}
      {step === "done" && (
        <ModalFooter align="between">
          {retryable ? (
            <Button onClick={() => void retryAll()}>
              <RotateCcw className="h-4 w-4" />
              Retry all failed
            </Button>
          ) : (
            <span />
          )}
          <Button variant="primary" onClick={close}>
            <Check className="h-4 w-4" />
            Done
          </Button>
        </ModalFooter>
      )}
    </Modal>
  )
}
