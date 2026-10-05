"use client"

import { useEffect, useRef, useState } from "react"
import { upload } from "@vercel/blob/client"
import { AlertCircle, CheckCircle2, FileText, Loader2, ScrollText, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MathText } from "@/components/ui/math-text"
import { cn } from "@/lib/utils"
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

type Step = "pick" | "uploading" | "ocr" | "reading" | "review" | "saving" | "done"

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
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
  const [result, setResult] = useState<{ added: number; skipped: number; topics: number } | null>(null)
  const busy = step === "uploading" || step === "ocr" || step === "reading" || step === "saving"

  useEffect(() => {
    if (!busy) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [busy])

  function close() {
    if (busy) return
    setOpen(false)
    setStep("pick")
    setError("")
    setQuestions([])
    setResult(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  async function handleFile(file: File) {
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      setError("Choose a PDF file")
      return
    }
    setError("")
    setStep("uploading")
    setProgress(0)
    try {
      type Read = { paper: string; questions: Omit<ReviewQuestion, "include">[]; topics: { id: string; label: string }[] }
      const safeName = file.name.replace(/[^a-z0-9.-]+/gi, "-").slice(-80)
      const blob = await upload(`textbooks/papers/${safeName}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/textbooks/upload",
        contentType: "application/pdf",
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
      setPaper(r.paper || file.name.replace(/\.pdf$/i, ""))
      setTopics(r.topics)
      // Questions without a topic stay unticked until one is chosen
      setQuestions(r.questions.map(q => ({ ...q, include: !!q.topicId })))
      setStep("review")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read the paper")
      setStep("pick")
    }
  }

  const update = (i: number, patch: Partial<ReviewQuestion>) => setQuestions(prev => prev.map((q, j) => (j === i ? { ...q, ...patch } : q)))
  const chosen = questions.filter(q => q.include && q.topicId)
  const workedOut = questions.filter(q => q.answerSource === "worked out").length

  async function save() {
    setStep("saving")
    setError("")
    try {
      const r = await postJson<{ added: number; skipped: number }>("/api/admin/papers/save", {
        moduleId,
        paper: paper.trim(),
        questions: chosen.map(({ question, options, correctOption, difficulty, topicId }) => ({ question, options, correctOption, difficulty, topicId })),
      })
      setResult({ ...r, topics: new Set(chosen.map(q => q.topicId)).size })
      setStep("done")
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the questions")
      setStep("review")
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <ScrollText className="h-4 w-4" />
        Add question paper
      </Button>

      <Modal open={open} onClose={close} size="xl" persistent={busy}>
        <ModalHeader onClose={busy ? undefined : close}>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ScrollText className="h-5 w-5" />
            Add a question paper
          </h2>
        </ModalHeader>

        <ModalBody className="space-y-5">
          {(step === "pick" || step === "uploading" || step === "ocr" || step === "reading") && (
            <>
              <p className="text-sm text-muted-foreground">
                Upload a past exam or assignment paper (PDF, with or without its memo). The AI turns each question into a
                multiple-choice question, keeping the paper&apos;s options and memo answers where it has them, and puts it in the
                topic it tests. You check them before anything is saved. The mock exam asks past-paper questions first.
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) void handleFile(f)
                }}
              />
              <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border p-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground" />
                {step === "pick" && (
                  <Button variant="primary" onClick={() => inputRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    Choose PDF
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
                    {workedOut} have answers worked out by the AI (no memo): check those.
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
                            {q.answerSource === "paper" ? "Answer from the paper" : "Answer worked out by AI"}
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

          {step === "done" && result && (
            <p className="flex items-start gap-2 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              Added {result.added} question{result.added === 1 ? "" : "s"} from {paper || "the paper"} to {result.topics} topic
              {result.topics === 1 ? "" : "s"}.{result.skipped ? ` ${result.skipped} were skipped (already in the topic).` : ""} The mock
              exam will ask them first.
            </p>
          )}

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
            <Button variant="primary" onClick={save} disabled={step === "saving" || chosen.length === 0}>
              {step === "saving" ? "Saving…" : `Add ${chosen.length} question${chosen.length === 1 ? "" : "s"}`}
            </Button>
          </ModalFooter>
        )}
        {step === "done" && (
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
