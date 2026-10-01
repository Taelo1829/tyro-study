"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"

interface DeleteQuestionButtonProps {
  questionId: string
  onDeleted: () => void
}

export function DeleteQuestionButton({ questionId, onDeleted }: DeleteQuestionButtonProps) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm("Delete this question? Students' saved answers to it will be removed too.")) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/questions/${questionId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to delete question")
      }
      onDeleted()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete question")
      setDeleting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      aria-label="Delete question"
      title="Delete question"
      className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
