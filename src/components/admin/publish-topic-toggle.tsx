"use client"

import { useState } from "react"
import { Globe, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Admin switch: publish a topic's lesson as a public study note, readable at
 * /notes without signing in, listed in the sitemap and shown with ads.
 * Unpublished lessons stay inside the app for signed-in students. Saves straight away.
 */
export function PublishTopicToggle({
  topicId,
  published,
  locked,
  hasLesson,
  onChanged,
}: {
  topicId: string
  published: boolean
  locked: boolean
  hasLesson: boolean
  onChanged: (published: boolean) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function toggle() {
    const next = !published
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/topics/${topicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Couldn't change publishing")
      }
      onChanged(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change publishing")
    } finally {
      setSaving(false)
    }
  }

  // Published, but the public page won't show it
  const hidden = published && (locked || !hasLesson)
  const Icon = published ? Globe : EyeOff

  return (
    <div className="mb-6 flex items-start gap-3 border-b border-border px-1 pb-5">
      <span
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          published ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
        )}
        aria-hidden="true"
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{published ? "Published as a public study note" : "Not public"}</p>
        <p className="text-sm text-muted-foreground">
          {published ? (
            <>
              Anyone can read this lesson at{" "}
              <a href={`/notes/${topicId}`} target="_blank" rel="noreferrer" className="underline">
                /notes/{topicId.slice(0, 8)}…
              </a>{" "}
              without signing in. It&apos;s in the sitemap and shows ads.
            </>
          ) : (
            "Only signed-in students see this lesson. Publish your best, most original lessons so Google judges the site on them."
          )}
        </p>
        {hidden && (
          <p className="mt-1 text-sm text-amber-700">
            {locked
              ? "It's locked, so it stays off the public notes until you unlock it."
              : "It has no written lesson yet, so it won't appear publicly."}
          </p>
        )}
        {error && <p className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={published}
        aria-label="Publish as public study note"
        onClick={toggle}
        disabled={saving}
        className={cn(
          "relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
          published ? "bg-primary" : "bg-muted ring-1 ring-border"
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
            published ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  )
}
