"use client"

import { useEffect, useRef, useState } from "react"
import { upload } from "@vercel/blob/client"
import { AlertCircle, BookOpen, Check, CheckCircle2, FileText, Loader2, RotateCcw, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Modal, ModalBody, ModalHeader } from "./modal"
import { ocrScannedPdf } from "./pdf-ocr"

/**
 * "Upload textbook": reads a textbook PDF and builds the module from it.
 *
 * 1. The PDF uploads straight from the browser to storage.
 * 2. The AI reads it and proposes chapters and topics (with page ranges).
 * 3. The admin reviews: untick, rename, choose lesson length and quiz size.
 * 4. The chapters and topics are created, then each topic's lesson and quiz
 *    is written from its own pages, a couple at a time, with progress shown.
 */

interface TextbookUploaderProps {
  moduleId: string
  onUploaded: () => void
}

interface ReviewTopic {
  title: string
  startPage: number
  endPage: number
  exists?: boolean
  include: boolean
}

interface ReviewChapter {
  title: string
  startPage: number
  endPage: number
  /** The module already has this chapter: new topics are added to it */
  existingChapterId?: string | null
  include: boolean
  topics: ReviewTopic[]
}

type TaskStatus = "waiting" | "working" | "done" | "failed"

interface Task {
  topicId: string
  number: string
  title: string
  startPage: number
  endPage: number
  status: TaskStatus
  note?: string
}

type Step = "pick" | "uploading" | "reading" | "ocr" | "review" | "creating" | "writing" | "done"
type Length = "short" | "standard" | "detailed"

const CONCURRENCY = 2

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data
}

const pages = (a: number, b: number) => (a === b ? `p. ${a}` : `pp. ${a}–${b}`)

export function TextbookUploader({ moduleId, onUploaded }: TextbookUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("pick")
  const [error, setError] = useState("")
  const [fileName, setFileName] = useState("")
  const [progress, setProgress] = useState(0)
  const [pagesUrl, setPagesUrl] = useState("")
  const [pageCount, setPageCount] = useState(0)
  const [chapters, setChapters] = useState<ReviewChapter[]>([])
  const [length, setLength] = useState<Length>("standard")
  const [questionCount, setQuestionCount] = useState(20)
  const [withVideos, setWithVideos] = useState(true)
  const [tasks, setTasks] = useState<Task[]>([])
  const stopRef = useRef(false)

  const [ocr, setOcr] = useState({ done: 0, total: 0 })
  const busy = step === "uploading" || step === "reading" || step === "ocr" || step === "creating" || step === "writing"

  // Leaving the page mid-import would stop it
  useEffect(() => {
    if (!busy) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [busy])

  const cleanup = (url = pagesUrl) => {
    if (url) void fetch("/api/admin/textbooks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) })
  }

  function reset() {
    setStep("pick")
    setError("")
    setFileName("")
    setProgress(0)
    setPagesUrl("")
    setPageCount(0)
    setChapters([])
    setTasks([])
    if (inputRef.current) inputRef.current.value = ""
  }

  function close() {
    if (busy) return
    // The import can't be picked up again once closed, so drop the saved page text
    if (step === "review" || step === "done") cleanup()
    setOpen(false)
    reset()
  }

  async function handleFile(file: File) {
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      setError("Choose a PDF file")
      return
    }
    setError("")
    setFileName(file.name)
    setStep("uploading")
    setProgress(0)
    try {
      const safeName = file.name.replace(/[^a-z0-9.-]+/gi, "-").slice(-80)
      const blob = await upload(`textbooks/${safeName}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/textbooks/upload",
        contentType: "application/pdf",
        multipart: file.size > 20 * 1024 * 1024,
        onUploadProgress: e => setProgress(Math.round(e.percentage)),
      })

      setStep("reading")
      type Analysis = { pagesUrl: string; pageCount: number; chapters: Omit<ReviewChapter, "include">[] }
      const first = await postJson<Analysis | { needsOcr: true; pageCount: number }>("/api/admin/textbooks/analyze", {
        moduleId,
        url: blob.url,
      })

      let result: Analysis
      if ("needsOcr" in first) {
        // A scanned book: read each page's text from its image, then carry on as normal
        if (first.pageCount > 1000) throw new Error("That scanned book is too long (over 1,000 pages). Split it into parts.")
        stopRef.current = false
        setOcr({ done: 0, total: first.pageCount })
        setStep("ocr")
        const read = await ocrScannedPdf(file, {
          onProgress: (done, total) => setOcr({ done, total }),
          shouldStop: () => stopRef.current,
        })
        setStep("reading")
        result = await postJson<Analysis>("/api/admin/textbooks/analyze", {
          moduleId,
          ocr: { pages: read.pages, labels: read.labels, outline: read.outline },
        })
      } else {
        result = first
      }
      setPagesUrl(result.pagesUrl)
      setPageCount(result.pageCount)
      setChapters(
        result.chapters.map(c => ({
          ...c,
          // A chapter the module already has stays ticked only if it has new topics
          include: !c.existingChapterId || c.topics.some(t => !t.exists),
          topics: c.topics.map(t => ({ ...t, include: !t.exists })),
        }))
      )
      setStep("review")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read the textbook")
      setStep("pick")
    }
  }

  const updateChapter = (ci: number, patch: Partial<ReviewChapter>) =>
    setChapters(prev => prev.map((c, i) => (i === ci ? { ...c, ...patch } : c)))
  const updateTopic = (ci: number, ti: number, patch: Partial<ReviewTopic>) =>
    setChapters(prev =>
      prev.map((c, i) => (i === ci ? { ...c, topics: c.topics.map((t, j) => (j === ti ? { ...t, ...patch } : t)) } : c))
    )

  const selected = chapters
    .filter(c => c.include && c.title.trim())
    .map(c => ({ ...c, topics: c.topics.filter(t => t.include && t.title.trim()) }))
    .filter(c => c.topics.length > 0)
  const selectedTopics = selected.reduce((n, c) => n + c.topics.length, 0)
  const newChapters = selected.filter(c => !c.existingChapterId).length

  async function runTasks(list: Task[]) {
    stopRef.current = false
    setStep("writing")
    const queue = list.filter(t => t.status !== "done").map(t => t.topicId)
    const setStatus = (topicId: string, status: TaskStatus, note?: string) =>
      setTasks(prev => prev.map(t => (t.topicId === topicId ? { ...t, status, note } : t)))
    const byId = new Map(list.map(t => [t.topicId, t]))

    const worker = async () => {
      while (queue.length && !stopRef.current) {
        const id = queue.shift()!
        const task = byId.get(id)!
        setStatus(id, "working")
        try {
          const r = await postJson<{
            wroteLesson: boolean
            questionsAdded: number
            videoTitle?: string | null
            videoNote?: string | null
          }>("/api/admin/textbooks/generate-topic", {
            topicId: id,
            pagesUrl,
            startPage: task.startPage,
            endPage: task.endPage,
            length,
            questionCount,
            video: withVideos,
          })
          const parts = [
            r.wroteLesson ? "lesson" : "",
            r.questionsAdded ? `${r.questionsAdded} questions` : "",
            r.videoTitle ? "video" : r.videoNote ? `no video (${r.videoNote})` : "",
          ]
          setStatus(id, "done", parts.filter(Boolean).join(" · ") || "already done")
        } catch (err) {
          setStatus(id, "failed", err instanceof Error ? err.message : "Failed")
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    setStep("done")
    onUploaded()
  }

  async function create() {
    setError("")
    setStep("creating")
    try {
      const result = await postJson<{
        chapters: { id: string; title: string; topics: { id: string; title: string; number: string; startPage: number; endPage: number }[] }[]
      }>("/api/admin/textbooks/create", {
        moduleId,
        chapters: selected.map(c => ({
          title: c.title.trim(),
          chapterId: c.existingChapterId ?? undefined,
          topics: c.topics.map(t => ({ title: t.title.trim(), startPage: t.startPage, endPage: t.endPage })),
        })),
      })
      onUploaded()
      const list: Task[] = result.chapters.flatMap(c =>
        c.topics.map(t => ({
          topicId: t.id,
          number: t.number,
          title: t.title,
          startPage: t.startPage,
          endPage: t.endPage,
          status: "waiting" as const,
        }))
      )
      setTasks(list)
      await runTasks(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the chapters")
      setStep("review")
    }
  }

  const done = tasks.filter(t => t.status === "done").length
  const failed = tasks.filter(t => t.status === "failed")
  const unfinished = tasks.filter(t => t.status !== "done").length

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <BookOpen className="h-4 w-4" />
        Upload textbook
      </Button>

      <Modal open={open} onClose={close} size="lg" persistent={busy}>
        <ModalHeader onClose={busy ? undefined : close}>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BookOpen className="h-5 w-5" />
            Build this module from a textbook
          </h2>
        </ModalHeader>
        <ModalBody className="space-y-5">
          {(step === "pick" || step === "uploading" || step === "reading" || step === "ocr") && (
            <>
              <p className="text-sm text-muted-foreground">
                Upload the textbook as a PDF. The AI finds its chapters and sections and suggests chapters and topics for this
                module. You check them, then it writes each topic&apos;s lesson and quiz from the book&apos;s pages, and can add a
                YouTube video to each topic.
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) void handleFile(file)
                }}
              />
              <div
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border p-8 text-center"
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  const file = e.dataTransfer.files?.[0]
                  if (file && step === "pick") void handleFile(file)
                }}
              >
                <FileText className="h-10 w-10 text-muted-foreground" />
                {step === "pick" && (
                  <>
                    <p className="text-sm text-muted-foreground">Drop a PDF here, or</p>
                    <Button type="button" variant="primary" onClick={() => inputRef.current?.click()}>
                      <Upload className="h-4 w-4" />
                      Choose PDF
                    </Button>
                    <p className="text-xs text-muted-foreground">Up to 300MB. Scanned books work too: their pages are read with OCR.</p>
                  </>
                )}
                {step === "uploading" && (
                  <div className="w-full max-w-sm space-y-2">
                    <p className="truncate text-sm font-medium">{fileName}</p>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">Uploading… {progress}%</p>
                  </div>
                )}
                {step === "ocr" && (
                  <div className="w-full max-w-sm space-y-2">
                    <p className="text-sm font-medium">This is a scanned book. Reading the text from each page…</p>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${ocr.total ? Math.round((ocr.done / ocr.total) * 100) : 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Page {ocr.done} of {ocr.total}. Keep this window open; a big book takes several minutes.
                    </p>
                    <button
                      type="button"
                      onClick={() => (stopRef.current = true)}
                      className="text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      Stop and use the pages read so far
                    </button>
                  </div>
                )}
                {step === "reading" && (
                  <div className="space-y-1">
                    <p className="flex items-center justify-center gap-2 text-sm font-medium">
                      <Loader2 className="h-4 w-4 animate-spin" /> Reading the textbook…
                    </p>
                    <p className="text-xs text-muted-foreground">Finding chapters and sections. A big book can take a minute or two.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {step === "review" && (
            <>
              <div>
                <p className="text-sm">
                  {`Found `}
                  <strong>
                    {chapters.length} chapter{chapters.length !== 1 ? "s" : ""}
                  </strong>
                  {` in ${pageCount} pages. Untick anything you don't want and fix any titles. New chapters are added after this module's existing chapters.`}
                </p>
                {chapters.some(c => c.existingChapterId || c.topics.some(t => t.exists)) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Topics this module already has are unticked. New topics for a chapter you already have go into that chapter.
                  </p>
                )}
              </div>

              <ol className="max-h-[45vh] space-y-4 overflow-y-auto pr-1">
                {chapters.map((chapter, ci) => (
                  <li key={ci}>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={chapter.include}
                        onChange={e => updateChapter(ci, { include: e.target.checked })}
                        aria-label={`Include chapter ${chapter.title}`}
                        className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                      />
                      <input
                        value={chapter.title}
                        onChange={e => updateChapter(ci, { title: e.target.value })}
                        disabled={!chapter.include || !!chapter.existingChapterId}
                        aria-label="Chapter title"
                        className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 font-semibold hover:border-border focus:border-foreground focus:outline-none disabled:opacity-50"
                      />
                      <span className="shrink-0 text-xs text-muted-foreground">{pages(chapter.startPage, chapter.endPage)}</span>
                    </div>
                    {chapter.existingChapterId && (
                      <p className="ml-8 text-xs text-amber-700">Already in this module: new topics are added to it</p>
                    )}
                    <ul className={cn("ml-6 mt-1 space-y-0.5 border-l border-border pl-3", !chapter.include && "opacity-50")}>
                      {chapter.topics.map((topic, ti) => (
                        <li key={ti} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={topic.include}
                            disabled={!chapter.include}
                            onChange={e => updateTopic(ci, ti, { include: e.target.checked })}
                            aria-label={`Include topic ${topic.title}`}
                            className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                          />
                          <input
                            value={topic.title}
                            onChange={e => updateTopic(ci, ti, { title: e.target.value })}
                            disabled={!chapter.include || !topic.include}
                            aria-label="Topic title"
                            className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-0.5 text-sm hover:border-border focus:border-foreground focus:outline-none disabled:opacity-50"
                          />
                          {topic.exists && <span className="shrink-0 text-xs text-amber-700">exists</span>}
                          <span className="shrink-0 text-xs text-muted-foreground">{pages(topic.startPage, topic.endPage)}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>

              <div className="flex flex-wrap gap-4 border-t border-border pt-4 text-sm">
                <label className="flex items-center gap-2">
                  Lessons
                  <select
                    value={length}
                    onChange={e => setLength(e.target.value as Length)}
                    className="rounded-full border border-border bg-white px-3 py-1.5"
                  >
                    <option value="short">Short</option>
                    <option value="standard">Standard</option>
                    <option value="detailed">Detailed</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  Quiz questions per topic
                  <select
                    value={questionCount}
                    onChange={e => setQuestionCount(Number(e.target.value))}
                    className="rounded-full border border-border bg-white px-3 py-1.5"
                  >
                    {[0, 5, 10, 15, 20].map(n => (
                      <option key={n} value={n}>
                        {n === 0 ? "None" : n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={withVideos}
                    onChange={e => setWithVideos(e.target.checked)}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  Find a YouTube video for each topic
                </label>
              </div>

              {error && <ErrorBox text={error} />}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => { cleanup(); reset() }} className="text-sm text-muted-foreground hover:text-foreground">
                  Use a different PDF
                </button>
                <Button variant="primary" disabled={selectedTopics === 0} onClick={create}>
                  {newChapters > 0
                    ? `Create ${newChapters} chapter${newChapters !== 1 ? "s" : ""} and ${selectedTopics} topic${selectedTopics !== 1 ? "s" : ""}`
                    : `Add ${selectedTopics} topic${selectedTopics !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </>
          )}

          {step === "creating" && (
            <p className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Adding chapters and topics…
            </p>
          )}

          {(step === "writing" || step === "done") && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {step === "writing"
                      ? withVideos
                        ? "Writing lessons and quizzes, finding videos…"
                        : "Writing lessons and quizzes…"
                      : failed.length
                        ? "Finished with some problems"
                        : unfinished
                          ? "Stopped"
                          : "All done"}
                  </span>
                  <span className="text-muted-foreground">
                    {done} of {tasks.length} topics
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${tasks.length ? Math.round((done / tasks.length) * 100) : 0}%` }}
                  />
                </div>
                {step === "writing" && (
                  <p className="text-xs text-muted-foreground">
                    Keep this window open. Topics already finished are saved, so if you stop, the rest show as &quot;No content&quot;
                    and you can write them later with Write with AI.
                  </p>
                )}
              </div>

              <ul className="max-h-[45vh] divide-y divide-border overflow-y-auto border-y border-border">
                {tasks.map(task => (
                  <li key={task.topicId} className="flex items-start gap-3 py-2 text-sm">
                    <span className="mt-0.5 shrink-0">
                      {task.status === "waiting" && <span className="block h-4 w-4 rounded-full border border-border" />}
                      {task.status === "working" && <Loader2 className="h-4 w-4 animate-spin" />}
                      {task.status === "done" && <Check className="h-4 w-4 text-green-700" />}
                      {task.status === "failed" && <X className="h-4 w-4 text-red-600" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="mr-2 tabular-nums text-muted-foreground">{task.number}</span>
                      {task.title}
                      {task.note && (
                        <span className={cn("block text-xs", task.status === "failed" ? "text-red-600" : "text-muted-foreground")}>
                          {task.note}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{pages(task.startPage, task.endPage)}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center justify-end gap-3">
                {step === "writing" && (
                  <Button variant="outline" onClick={() => (stopRef.current = true)}>
                    Stop after current topics
                  </Button>
                )}
                {step === "done" && unfinished > 0 && (
                  <Button variant="outline" onClick={() => runTasks(tasks)}>
                    <RotateCcw className="h-4 w-4" />
                    {failed.length ? "Retry" : "Continue with"} {unfinished} topic{unfinished !== 1 ? "s" : ""}
                  </Button>
                )}
                {step === "done" && (
                  <Button variant="primary" onClick={close}>
                    <CheckCircle2 className="h-4 w-4" />
                    Close
                  </Button>
                )}
              </div>
            </>
          )}

          {error && step === "pick" && <ErrorBox text={error} />}
        </ModalBody>
      </Modal>
    </>
  )
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{text}</p>
    </div>
  )
}
