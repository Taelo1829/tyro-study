"use client"

import { useState } from "react"
import { FolderInput } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "./modal"

interface Destination {
  id: string
  title: string
  chapters: {
    id: string
    title: string
    topics: { id: string; title: string }[]
  }[]
}

interface MoveQuestionButtonProps {
  questionId: string
  /** Shown in the dialog so you can see which question you're moving */
  questionText?: string
  /** Where the question is now, so it can be shown as the current choice */
  currentTopicId?: string | null
  currentChapterId?: string | null
  onMoved: () => void
}

// Option values are "topic:<id>" or "chapter:<id>"

/** Drop numbering a title may already carry ("2.3 Loops" → "Loops") so it isn't shown twice */
function stripNumber(title: string) {
  return title.replace(/^\s*(?:\d+(?:\.\d+)+\.?|\d+[.):\-–])\s+/, "") || title
}
function currentValue(topicId?: string | null, chapterId?: string | null) {
  if (topicId) return `topic:${topicId}`
  if (chapterId) return `chapter:${chapterId}`
  return ""
}

export function MoveQuestionButton({
  questionId,
  questionText,
  currentTopicId,
  currentChapterId,
  onMoved,
}: MoveQuestionButtonProps) {
  const [open, setOpen] = useState(false)
  const [destinations, setDestinations] = useState<Destination[] | null>(null)
  const [value, setValue] = useState(currentValue(currentTopicId, currentChapterId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function openPicker() {
    setOpen(true)
    setError("")
    setValue(currentValue(currentTopicId, currentChapterId))
    if (destinations) return
    try {
      const res = await fetch(`/api/admin/question-destinations?questionId=${encodeURIComponent(questionId)}`)
      if (!res.ok) throw new Error("Could not load topics and chapters")
      setDestinations(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load topics and chapters")
    }
  }

  async function move() {
    const [kind, id] = value.split(":")
    if (!kind || !id) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "topic" ? { topicId: id } : { chapterId: id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to move question")
      }
      setOpen(false)
      onMoved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move question")
    } finally {
      setSaving(false)
    }
  }

  const unchanged = value === currentValue(currentTopicId, currentChapterId)

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        aria-label="Move question"
        title="Move to another topic or chapter"
        className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
      >
        <FolderInput className="h-4 w-4" />
      </button>

      <Modal open={open} onClose={() => !saving && setOpen(false)} size="md">
        <ModalHeader onClose={() => !saving && setOpen(false)}>Move question</ModalHeader>
        <ModalBody className="space-y-3">
          {questionText && (
            <p className="text-sm text-muted-foreground line-clamp-3">{questionText}</p>
          )}
          <label className="block text-sm font-medium" htmlFor={`move-${questionId}`}>
            Move to
          </label>
          <select
            id={`move-${questionId}`}
            value={value}
            onChange={e => setValue(e.target.value)}
            disabled={!destinations || saving}
            className="neo-inset h-10 w-full rounded-[var(--neo-radius)] bg-transparent px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            {!destinations && <option value="">Loading…</option>}
            {destinations?.map(mod => (
              <optgroup key={mod.id} label={mod.title}>
                {/* Numbered in course order: chapter 1, its topics 1.1, 1.2, … */}
                {mod.chapters.flatMap((ch, c) => [
                  <option key={`c-${ch.id}`} value={`chapter:${ch.id}`}>
                    {c + 1}. {stripNumber(ch.title)} — chapter quiz only
                  </option>,
                  ...ch.topics.map((tp, t) => (
                    <option key={`t-${tp.id}`} value={`topic:${tp.id}`}>
                      {"\u00A0\u00A0\u00A0\u00A0"}{c + 1}.{t + 1} {stripNumber(tp.title)}
                    </option>
                  )),
                ])}
              </optgroup>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Questions can be moved within this module only. Topic questions also appear in their chapter&apos;s quiz. &ldquo;Chapter quiz only&rdquo; questions don&apos;t belong to any topic.
          </p>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={move} disabled={!destinations || saving || unchanged || !value}>
            {saving ? "Moving…" : "Move question"}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
