"use client"
import { generationFetch, queueGeneration, waitForGeneration } from "@/lib/generation-client"

import { useEffect, useRef, useState } from "react"
import { paperReviewResult } from "@/lib/paper-review"
import type { GenerationJob } from "@/lib/generation-types"
import { upload } from "@vercel/blob/client"
import { AlertCircle, CheckCircle2, FileText, Loader2, ScrollText, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MathText } from "@/components/ui/math-text"
import { cn } from "@/lib/utils"
import type { PaperSource, LessonReplacement } from "@/lib/module-recreation-input"
import { sanitizeTopicHtml } from "@/lib/topic-content"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "./modal"
import { ocrScannedPdf } from "./pdf-ocr"

/**
 * "Add question paper": a past exam or assignment paper becomes quiz questions.
 *
 * 1. The PDF uploads straight from the browser to storage (scanned papers are
 *    read with OCR in the browser).
 * 2. The AI turns each question into a multiple-choice question (keeping the
 *    paper's options and memo answer where it has them) and picks its topic.
 * 3. The admin checks the topic and answer of each, then saves. The questions
 *    join their topics' quizzes, and the mock exam asks them first.
 */

interface ReviewQuestion {
  number: string
  question: string
  options: string[]
  correctOption: string
  answerSource: "paper" | "worked out"
  difficulty: string
  topicId: string | null
  include: boolean
}

type Step = "pick" | "uploading" | "ocr" | "reading" | "review" | "drafting" | "saving"
type ReadPaper = { source: PaperSource; paper: string; questions: Omit<ReviewQuestion, "include">[]; topics: { id: string; label: string }[] }

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await generationFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data
}

export function PaperUploader({ moduleId, onAdded }: { moduleId: string; onAdded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("pick")
  const [error, setError] = useState("")
  const [progress, setProgress] = useState(0)
  const [ocr, setOcr] = useState({ done: 0, total: 0 })
  const [paper, setPaper] = useState("")
  const [topics, setTopics] = useState<{ id: string; label: string }[]>([])
  const [questions, setQuestions] = useState<ReviewQuestion[]>([])
  const [result, setResult] = useState<{ added: number; skipped: number; topics: number; paper: string } | null>(null)
  const [source, setSource] = useState<PaperSource | null>(null)
  const [lessons, setLessons] = useState<(LessonReplacement & { title: string })[]>([])
  const [reviewed, setReviewed] = useState(false)
  const busy = step === "drafting" || step === "uploading" || step === "ocr" || step === "reading" || step === "saving"

  // Notification links restore the saved question review without another upload.
  useEffect(() => {
    const jobId = new URL(window.location.href).searchParams.get("paperJob")
    if (!jobId) return
    let cancelled = false
    async function restore() {
      try {
        const response = await fetch(`/api/generation?id=${encodeURIComponent(jobId!)}`, { cache: "no-store" })
        if (!response.ok) throw new Error("Couldn't load your saved questions. Open Generation progress to try again.")
        const job = await response.json() as GenerationJob | null
        const review = job && paperReviewResult(job, moduleId)
        if (!review) throw new Error("These paper questions are not ready for review in this module.")
        if (cancelled) return
        const data = review.data as ReadPaper
        setSource(data.source); setPaper(data.paper || "Question paper"); setTopics(data.topics)
        setQuestions(data.questions.map(q => ({ ...q, include: !!q.topicId })))
        setLessons([]); setReviewed(false); setResult(null); setError(""); setStep("review"); setOpen(true)
        const url = new URL(window.location.href)
        url.searchParams.delete("paperJob")
        window.history.replaceState(window.history.state, "", url.toString())
      } catch (error) {
        if (!cancelled) { setError(error instanceof Error ? error.message : "Couldn't restore questions"); setOpen(true) }
      }
    }
    void restore()
    return () => { cancelled = true }
  }, [moduleId])

  function resetUpload() {
    setStep("pick")
    setError("")
    setProgress(0)
    setOcr({ done: 0, total: 0 })
    setPaper("")
    setTopics([])
    setQuestions([])
    setSource(null)
    setLessons([])
    setReviewed(false)
    setResult(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  function close() {
    if (busy) return
    setOpen(false)
    resetUpload()
  }

  async function handleFile(file: File) {
    resetUpload()
    const isWord = /\.docx$/i.test(file.name)
    if (!isWord && !/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      setError(/\.doc$/i.test(file.name) ? "Save this older Word document as .docx or PDF, then upload it." : "Choose a PDF or Word (.docx) file")
      return
    }
    setError("")
    setStep("uploading")
    setProgress(0)
    try {
      type Read = ReadPaper
      const safeName = file.name.replace(/[^a-z0-9.-]+/gi, "-").slice(-80)
      const blob = await upload(`textbooks/papers/${safeName}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/textbooks/upload",
        contentType: isWord ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf",
        onUploadProgress: e => setProgress(Math.round(e.percentage)),
      })
      setStep("reading")
      let read = await postJson<Read | { needsOcr: true; pageCount: number }>("/api/admin/papers/read", { moduleId, url: blob.url })
      if ("needsOcr" in read) {
        // A scanned paper: read its pages from their images first
        setOcr({ done: 0, total: read.pageCount })
        setStep("ocr")
        const scanned = await ocrScannedPdf(file, { onProgress: (done, total) => setOcr({ done, total }), shouldStop: () => false })
        setStep("reading")
        read = await postJson<Read>("/api/admin/papers/read", { moduleId, ocr: { pages: scanned.pages } })
      }
      const r = read as Read
      setSource(r.source); setLessons([]); setReviewed(false)
      setPaper(r.paper || file.name.replace(/\.(pdf|docx)$/i, ""))
      setTopics(r.topics)
      // Questions without a topic stay unticked until one is chosen
      setQuestions(r.questions.map(q => ({ ...q, include: !!q.topicId })))
      setStep("review")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read the paper")
      setStep("pick")
    }
  }

  const update = (i: number, patch: Partial<ReviewQuestion>) => { setLessons([]); setReviewed(false); setQuestions(prev => prev.map((q, j) => (j === i ? { ...q, ...patch } : q))) }
  const chosen = questions.filter(q => q.include && q.topicId)
  const workedOut = questions.filter(q => q.answerSource === "worked out").length

  const lessonsReady = lessons.length > 0 && [...new Set(chosen.map(q => q.topicId))].every(id => lessons.some(l => l.topicId === id))
  async function prepareLessons() {
    if (!source) return setError("Read the question paper again to prepare lesson updates.")
    const invalid = chosen.filter(q => {
      const opts = [...new Set((q.options || []).map(o => o.trim()).filter(Boolean))]
      return !q.question?.trim() || opts.length < 2 || opts.length > 6 || !opts.includes(q.correctOption?.trim())
    })
    if (invalid.length > 0) {
      return setError(`Please select the correct answer for ${invalid.map(q => q.number || "each question").join(", ")}.`)
    }
    setStep("drafting"); setError(""); setReviewed(false)
    try {
      const ids = [...new Set(chosen.map(q => q.topicId!))]
      const jobId = await queueGeneration(ids.map(topicId => ({ path: "/api/admin/papers/lesson", body: { moduleId, topicId, source, questions: chosen.filter(q => q.topicId === topicId) }, label: topics.find(t => t.id === topicId)?.label })), "Question paper lesson updates")
      const job = await waitForGeneration(jobId)
      setLessons(job.results.map(r => r.data as LessonReplacement & { title: string }))
    } catch (error) { setError(error instanceof Error ? error.message : "Could not draft lessons") }
    finally { setStep("review") }
  }

  async function save() {
    if (!lessonsReady || !reviewed) return
    const invalid = chosen.filter(q => {
      const opts = [...new Set((q.options || []).map(o => o.trim()).filter(Boolean))]
      return !q.question?.trim() || opts.length < 2 || opts.length > 6 || !opts.includes(q.correctOption?.trim())
    })
    if (invalid.length > 0) {
      return setError(`Please select the correct answer for ${invalid.map(q => q.number || "each question").join(", ")}.`)
    }
    setStep("saving")
    setError("")
    try {
      const cleanQuestions = chosen.map(q => {
        const options = [...new Set(q.options.map(o => o.trim()).filter(Boolean))]
        return {
          question: q.question.trim(),
          options,
          correctOption: q.correctOption.trim(),
          difficulty: q.difficulty,
          topicId: q.topicId,
        }
      })
      const r = await postJson<{ added: number; skipped: number; topics: number }>("/api/admin/papers/save", {
        moduleId,
        paper: paper.trim(),
        lessons,
        questions: cleanQuestions,
      })
      resetUpload()
      setResult({ ...r, paper: paper.trim() })
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the questions")
      setStep("review")
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScrollText className="h-4 w-4" />}
        {busy ? "View paper progress" : step === "review" ? "Review question paper" : "Add question paper"}
      </Button>

      <Modal open={open} onClose={close} size="xl" persistent={busy}>
        <ModalHeader onClose={busy ? undefined : close}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ScrollText className="h-5 w-5" />
              Add a question paper
            </h2>
            {busy && <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>Hide</Button>}
          </div>
          {busy && <p className="mt-2 text-sm text-muted-foreground">You can hide this window while processing continues. Reopen it using View paper progress.</p>}
        </ModalHeader>

        <ModalBody className="space-y-5">
          {(step === "pick" || step === "uploading" || step === "ocr" || step === "reading") && (
            <>
              <p className="text-sm text-muted-foreground">
                Upload a past exam or assignment paper (PDF or Word .docx, with or without its memo). Each question is converted into a
                multiple-choice question, keeping the paper&apos;s options and memo answers where it has them, and puts it in the
                topic it tests. Review or change each topic before saving. Questions are added to those topics’ quiz banks. Review cohesive lesson updates for the selected topics before saving both together.
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  e.target.value = ""
                  if (f) void handleFile(f)
                }}
              />
              <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border p-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground" />
                {step === "pick" && (
                  <Button variant="primary" onClick={() => inputRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    Choose PDF or Word
                  </Button>
                )}
                {step === "uploading" && <p className="text-sm text-muted-foreground">Uploading… {progress}%</p>}
                {step === "ocr" && (
                  <p className="text-sm text-muted-foreground">
                    Reading the scanned pages… page {ocr.done} of {ocr.total}
                  </p>
                )}
                {step === "reading" && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reading the questions and matching them to topics… this takes a minute or two.
                  </p>
                )}
              </div>
            </>
          )}

          {(step === "review" || step === "saving") && (
            <>
              <div>
                <label htmlFor="paper-name" className="mb-1.5 block text-sm font-medium">
                  Paper name (shown with its questions)
                </label>
                <Input id="paper-name" value={paper} onChange={e => setPaper(e.target.value)} maxLength={120} placeholder="e.g. Oct/Nov 2023 exam" />
              </div>
              <p className="text-sm text-muted-foreground">
                {questions.length} questions found.{" "}
                {workedOut > 0 && (
                  <span className="font-medium text-amber-800">
                    {workedOut} have automatically drafted answers (no memo): review those carefully.
                  </span>
                )}{" "}
                Pick the right answer by tapping an option.
              </p>
              <ul className="space-y-3">
                {questions.map((q, i) => (
                  <li key={i} className={cn("rounded-2xl border p-4", q.include ? "border-border" : "border-dashed border-border opacity-60")}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-black"
                        checked={q.include}
                        onChange={e => update(i, { include: e.target.checked })}
                        aria-label={`Include ${q.number}`}
                        disabled={step === "saving"}
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold">{q.number}</span>
                          <span className={cn("rounded-full px-2 py-0.5 font-medium", q.answerSource === "paper" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800")}>
                            {q.answerSource === "paper" ? "Answer from the paper" : "Draft answer — no memo"}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm font-medium">
                          <MathText text={q.question} />
                        </p>
                        <ul className="space-y-1">
                          {q.options.map(o => (
                            <li key={o}>
                              <button
                                type="button"
                                onClick={() => update(i, { correctOption: o })}
                                disabled={step === "saving"}
                                className={cn(
                                  "w-full rounded-xl px-3 py-1.5 text-left text-sm",
                                  o === q.correctOption ? "bg-green-50 font-medium text-green-800" : "text-muted-foreground hover:bg-muted"
                                )}
                              >
                                {o === q.correctOption ? "✓ " : "○ "}
                                <MathText text={o} />
                              </button>
                            </li>
                          ))}
                        </ul>
                        <select
                          value={q.topicId ?? ""}
                          onChange={e => update(i, { topicId: e.target.value || null, include: !!e.target.value })}
                          disabled={step === "saving"}
                          aria-label={`Topic for ${q.number}`}
                          className={cn("w-full rounded-full border bg-white px-3 py-1.5 text-sm", q.topicId ? "border-border" : "border-amber-400")}
                        >
                          <option value="">Choose a topic…</option>
                          {topics.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {step === "pick" && result && (
            <p role="status" className="flex items-start gap-2 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              Added {result.added} question{result.added === 1 ? "" : "s"} from {result.paper || "the paper"} to {result.topics} topic
              {result.topics === 1 ? "" : "s"}.{result.skipped ? ` ${result.skipped} were skipped (already in the topic).` : ""} The selected lessons have been updated, and topic and chapter quizzes prioritize unanswered uploaded questions.
            </p>
          )}

          {step === "drafting" && <p role="status">Drafting lesson updates in the background. You can leave this page; results are saved in Generation activity.</p>}
          {lessons.map(lesson => <details key={lesson.topicId} className="rounded border p-3"><summary>Review lesson: {lesson.title}</summary><div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeTopicHtml(lesson.html) }} /></details>)}
          {lessonsReady && <label className="flex gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I reviewed these lesson replacements and the selected paper questions.</label>}
          {error && (
            <p className="flex items-start gap-2 text-sm text-red-600" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
        </ModalBody>

        {(step === "review" || step === "saving") && (
          <ModalFooter>
            <Button variant="ghost" onClick={close} disabled={step === "saving"}>
              Cancel
            </Button>
            {!lessonsReady && <Button onClick={() => void prepareLessons()} disabled={step === "saving" || chosen.length === 0}>Prepare lesson updates</Button>}
            <Button variant="primary" onClick={save} disabled={step === "saving" || chosen.length === 0 || !lessonsReady || !reviewed}>
              {step === "saving" ? "Saving…" : `Add ${chosen.length} question${chosen.length === 1 ? "" : "s"}`}
            </Button>
          </ModalFooter>
        )}
        {step === "pick" && result && (
          <ModalFooter>
            <Button variant="primary" onClick={close}>
              Done
            </Button>
          </ModalFooter>
        )}
      </Modal>
    </>
  )
}
