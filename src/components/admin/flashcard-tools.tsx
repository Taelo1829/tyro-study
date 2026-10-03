"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MathText } from "@/components/ui/math-text"
import { ExcelBulkImport } from "./excel-bulk-import"

interface Flashcard {
  id: string
  front: string
  back: string
}

/** Flashcards tab on the admin topic page: AI generation, Excel upload and the saved cards */
export function FlashcardTools({
  topicId,
  flashcards,
  hasLesson,
  onChanged,
}: {
  topicId: string
  flashcards: Flashcard[]
  hasLesson: boolean
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null)

  async function generate() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch("/api/ai/generate-flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, count: 10 }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Generation failed")
      setMessage({ kind: "ok", text: `Added ${data.count} flashcards from the lesson.` })
      onChanged()
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Generation failed" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="font-semibold">Generate with AI</h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {hasLesson
              ? "Creates 10 flashcards from this topic's saved lesson."
              : "Write and save a lesson first — the AI makes flashcards from it."}
          </p>
          <Button variant="primary" className="shrink-0" onClick={generate} disabled={busy || !hasLesson}>
            <Sparkles className="h-4 w-4" />
            {busy ? "Generating…" : "Generate 10 flashcards"}
          </Button>
        </div>
        {message && (
          <p className={message.kind === "error" ? "text-sm text-red-600" : "text-sm text-muted-foreground"} role="status">
            {message.text}
          </p>
        )}
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h3 className="font-semibold">Bulk upload (Excel)</h3>
        <ExcelBulkImport topicId={topicId} type="flashcards" onImported={onChanged} />
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <h3 className="font-semibold">Saved flashcards ({flashcards.length})</h3>
        {flashcards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No flashcards yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {flashcards.map((card, i) => (
              <li key={card.id} className="rounded-2xl border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground">{i + 1}</p>
                <p className="mt-1 font-medium"><MathText text={card.front} /></p>
                <p className="mt-2 border-t border-dashed border-border pt-2 text-sm text-muted-foreground"><MathText text={card.back} /></p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
