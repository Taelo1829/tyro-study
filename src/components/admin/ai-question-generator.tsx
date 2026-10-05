"use client"

import { useState } from "react"
import { Check, RotateCcw, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MathText } from "@/components/ui/math-text"
import { cn } from "@/lib/utils"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "./modal"

/**
 * "Generate questions with AI" for a topic quiz or a chapter quiz.
 * Options → the AI drafts questions → review (untick or delete any you don't
 * want) → save the rest. Nothing is saved until you press Save.
 */

type Difficulty = "easy" | "medium" | "hard"
type DifficultyChoice = Difficulty | "mixed"

interface DraftQuestion {
  question: string
  options: string[]
  correctOption: string
  difficulty: Difficulty
  explanation?: string
  keep: boolean
}

const COUNTS = [5, 10, 15, 20]
const DIFFICULTIES: { id: DifficultyChoice; label: string }[] = [
  { id: "mixed", label: "Mixed" },
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
]
const LEVEL_STYLE: Record<Difficulty, string> = {
  easy: "bg-green-100 text-green-800",
  medium: "bg-sky-100 text-sky-800",
  hard: "bg-orange-100 text-orange-800",
}

interface Props {
  topicId?: string
  chapterId?: string
  onSaved: () => void
}

function Choice<T extends string | number>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
  label: string
  disabled?: boolean
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map(o => (
          <button
            key={String(o.id)}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={cn(
              "min-w-14 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              value === o.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-muted/70"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function AiQuestionGenerator({ topicId, chapterId, onSaved }: Props) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(20)
  const [difficulty, setDifficulty] = useState<DifficultyChoice>("mixed")
  const [notes, setNotes] = useState("")
  const [drafts, setDrafts] = useState<DraftQuestion[]>([])
  const [busy, setBusy] = useState<"generating" | "saving" | null>(null)
  const [error, setError] = useState("")

  const reviewing = drafts.length > 0
  const kept = drafts.filter(d => d.keep)
  const scopeLabel = topicId ? "this topic" : "this chapter"

  function close() {
    if (busy) return
    if (reviewing && kept.length > 0 && !confirm("Discard these draft questions?")) return
    setOpen(false)
    setDrafts([])
    setError("")
  }

  async function generate() {
    setBusy("generating")
    setError("")
    try {
      const res = await fetch("/api/ai/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, chapterId, count, difficulty, notes }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "The AI couldn't write questions")
      const fresh = (data.questions as Omit<DraftQuestion, "keep">[]).map(q => ({ ...q, keep: true }))
      // "Generate more" adds to the list, skipping repeats
      setDrafts(prev => {
        const seen = new Set(prev.map(p => p.question.toLowerCase()))
        return [...prev, ...fresh.filter(q => !seen.has(q.question.toLowerCase()))]
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "The AI couldn't write questions")
    } finally {
      setBusy(null)
    }
  }

  async function save() {
    if (kept.length === 0) return
    setBusy("saving")
    setError("")
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId,
          chapterId,
          questions: kept.map(({ question, options, correctOption, difficulty }) => ({ question, options, correctOption, difficulty })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Saving failed")
      setDrafts([])
      setOpen(false)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saving failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          The AI writes UNISA-style multiple-choice questions from {scopeLabel}&apos;s {topicId ? "lesson and PDFs" : "topics and lessons"}, avoiding ones you already have. You review them before anything is saved.
        </p>
        <Button variant="primary" className="shrink-0" onClick={() => { setError(""); setOpen(true) }}>
          <Sparkles className="h-4 w-4" />
          Generate questions
        </Button>
      </div>

      <Modal open={open} onClose={close} size={reviewing ? "lg" : "md"}>
        <ModalHeader onClose={close}>
          {reviewing ? `Review questions (${kept.length} of ${drafts.length} selected)` : "Generate questions with AI"}
        </ModalHeader>

        <ModalBody className="space-y-4">
          {!reviewing ? (
            <>
              <Choice
                label="How many?"
                value={count}
                options={COUNTS.map(c => ({ id: c, label: String(c) }))}
                onChange={setCount}
                disabled={!!busy}
              />
              <Choice label="Difficulty" value={difficulty} options={DIFFICULTIES} onChange={setDifficulty} disabled={!!busy} />
              <div>
                <label htmlFor={`aiq-notes-${topicId ?? chapterId}`} className="mb-2 block text-sm font-medium">
                  Anything to focus on? <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  id={`aiq-notes-${topicId ?? chapterId}`}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  disabled={!!busy}
                  rows={3}
                  maxLength={2000}
                  placeholder="e.g. More code-tracing questions; focus on while loops."
                  className="neo-inset w-full resize-y rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </>
          ) : (
            <ul className="space-y-3">
              {drafts.map((q, i) => (
                <li
                  key={`${i}-${q.question.slice(0, 20)}`}
                  className={cn("rounded-2xl border p-4 transition-opacity", q.keep ? "border-border bg-card" : "border-dashed border-border bg-muted/40 opacity-60")}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={q.keep}
                      aria-label={q.keep ? "Don't save this question" : "Save this question"}
                      onClick={() => setDrafts(prev => prev.map((d, j) => (j === i ? { ...d, keep: !d.keep } : d)))}
                      className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                        q.keep ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50"
                      )}
                    >
                      {q.keep && <Check className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">{i + 1}.</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", LEVEL_STYLE[q.difficulty])}>{q.difficulty}</span>
                      </div>
                      <p className="whitespace-pre-wrap font-medium"><MathText text={q.question} /></p>
                      <ul className="mt-2 space-y-1">
                        {q.options.map(opt => (
                          <li key={opt} className={cn("text-sm", opt === q.correctOption ? "font-medium text-green-700" : "text-muted-foreground")}>
                            {opt === q.correctOption ? "✓ " : "○ "}
                            <MathText text={opt} />
                          </li>
                        ))}
                      </ul>
                      {q.explanation && <p className="mt-2 text-xs text-muted-foreground">Why: {q.explanation}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDrafts(prev => prev.filter((_, j) => j !== i))}
                      aria-label="Delete this draft"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {busy === "generating" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              Writing questions… this can take up to a minute.
            </p>
          )}
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        </ModalBody>

        <ModalFooter>
          {!reviewing ? (
            <>
              <Button variant="ghost" onClick={close} disabled={!!busy}>Cancel</Button>
              <Button variant="primary" onClick={generate} disabled={!!busy}>
                <Sparkles className="h-4 w-4" />
                {busy ? "Writing…" : `Generate ${count}`}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={generate} disabled={!!busy}>
                <RotateCcw className="h-4 w-4" />
                {busy === "generating" ? "Writing…" : "Generate more"}
              </Button>
              <Button variant="primary" onClick={save} disabled={!!busy || kept.length === 0}>
                {busy === "saving" ? "Saving…" : `Save ${kept.length} question${kept.length !== 1 ? "s" : ""}`}
              </Button>
            </>
          )}
        </ModalFooter>
      </Modal>
    </>
  )
}
