"use client"

import { useEffect, useState } from "react"
import { Globe } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Counts {
  total: number
  published: number
  live: number
}

/**
 * Module-wide publishing: shows how many topics are public study notes and
 * publishes or unpublishes them all at once. Individual topics are switched
 * on the topic page.
 */
export function ModulePublishControl({ moduleId }: { moduleId: string }) {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    fetch(`/api/modules/${moduleId}/publish`)
      .then(res => (res.ok ? (res.json() as Promise<Counts>) : null))
      .then(data => {
        if (!cancelled && data) setCounts(data)
      })
    return () => {
      cancelled = true
    }
  }, [moduleId])

  async function setAll(published: boolean) {
    const question = published
      ? `Publish all ${counts?.total ?? ""} topics in this module as public study notes?`
      : "Make every topic in this module private (signed-in students only)?"
    if (!confirm(question)) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/modules/${moduleId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Couldn't update publishing")
      setCounts({ total: data.total, published: data.published, live: data.live })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update publishing")
    } finally {
      setSaving(false)
    }
  }

  if (!counts) return null

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border px-4 py-3">
      <Globe className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">
          {counts.published} of {counts.total} topic{counts.total !== 1 ? "s" : ""} published
        </p>
        <p className="text-muted-foreground">
          {counts.live === counts.published
            ? "Published lessons are public study notes at /notes."
            : `${counts.live} showing publicly; the rest are locked or have no lesson yet.`}
        </p>
        {error && <p className="mt-1 text-red-600" role="alert">{error}</p>}
      </div>
      <div className="flex gap-2">
        {counts.published < counts.total && (
          <Button variant="ghost" size="sm" disabled={saving} onClick={() => setAll(true)}>
            Publish all
          </Button>
        )}
        {counts.published > 0 && (
          <Button variant="ghost" size="sm" disabled={saving} onClick={() => setAll(false)}>
            Unpublish all
          </Button>
        )}
      </div>
    </div>
  )
}
