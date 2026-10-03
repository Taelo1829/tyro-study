"use client"

import { useState } from "react"
import { Lock, LockOpen } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Admin switch: lock a topic so students must pass the previous topic's quiz
 * before it opens. Saves straight away.
 */
export function LockTopicToggle({
  topicId,
  locked,
  onChanged,
}: {
  topicId: string
  locked: boolean
  onChanged: (locked: boolean) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function toggle() {
    const next = !locked
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/topics/${topicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Couldn't change the lock")
      }
      onChanged(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change the lock")
    } finally {
      setSaving(false)
    }
  }

  const Icon = locked ? Lock : LockOpen

  return (
    <div className="mb-6 flex items-start gap-3 border-b border-border px-1 pb-5">
      <span
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          locked ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"
        )}
        aria-hidden="true"
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{locked ? "Topic is locked" : "Topic is open"}</p>
        <p className="text-sm text-muted-foreground">
          {locked
            ? "Students must pass the previous topic's quiz (70% or more) before this topic opens."
            : "Lock it to make the previous topic compulsory: students must pass its quiz first."}
        </p>
        {error && <p className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={locked}
        aria-label="Lock topic"
        onClick={toggle}
        disabled={saving}
        className={cn(
          "relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
          locked ? "bg-primary" : "bg-muted ring-1 ring-border"
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
            locked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  )
}
