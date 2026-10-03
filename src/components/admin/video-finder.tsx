"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, ExternalLink, Loader2, RefreshCw, Sparkles, MonitorPlay } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "./modal"

interface Candidate {
  id: string
  url: string
  title: string
  channel: string
  thumbnail: string
  seconds: number
  views: number
}

interface Suggestion {
  description: string
  query: string
  video: Candidate | null
  reason: string
  alternatives: Candidate[]
}

const minutes = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : `${Math.round(s / 60)} min`)
const views = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M views` : n >= 1000 ? `${Math.round(n / 1000)}K views` : `${n} views`

async function fetchSuggestion(topicId: string, exclude: string[], tried: string[] = []): Promise<Suggestion> {
  const res = await fetch("/api/ai/find-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topicId, exclude, tried }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? "Couldn't find a video")
  return data as Suggestion
}

/**
 * "Find video with AI": the AI describes the ideal video for this topic,
 * searches YouTube and picks the best match. The admin can choose another
 * result, then the video is added to the end of the lesson and saved.
 * Render it only while open (it searches as soon as it mounts).
 */
export function VideoFinder({
  topicId,
  onClose,
  onAdd,
}: {
  topicId: string
  onClose: () => void
  /** Add the video to the lesson and save; resolves when saved */
  onAdd: (videoUrl: string) => Promise<void>
}) {
  const [result, setResult] = useState<Suggestion | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState<"search" | "add" | null>("search")
  const [error, setError] = useState("")
  const [seen, setSeen] = useState<string[]>([])
  const [tried, setTried] = useState<string[]>([])

  const apply = useCallback((next: Suggestion) => {
    setResult(next)
    setSelected(next.video?.id ?? next.alternatives[0]?.id ?? null)
    setSeen(prev => [...new Set([...prev, ...(next.video ? [next.video.id] : []), ...next.alternatives.map(v => v.id)])])
    if (next.query) setTried(prev => [...new Set([...prev, next.query])])
  }, [])

  const fail = useCallback((err: unknown) => setError(err instanceof Error ? err.message : "Couldn't find a video"), [])

  // First search as soon as the window opens
  useEffect(() => {
    let live = true
    fetchSuggestion(topicId, [])
      .then(next => live && apply(next))
      .catch(err => live && fail(err))
      .finally(() => live && setBusy(null))
    return () => {
      live = false
    }
  }, [topicId, apply, fail])

  const searchAgain = async () => {
    setBusy("search")
    setError("")
    try {
      // Skip videos already shown, and ask for a different search
      apply(await fetchSuggestion(topicId, seen, tried))
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  const all = result ? [...(result.video ? [result.video] : []), ...result.alternatives] : []
  const chosen = all.find(v => v.id === selected) ?? null

  const add = async () => {
    if (!chosen) return
    setBusy("add")
    setError("")
    try {
      await onAdd(chosen.url)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the lesson")
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal open onClose={() => busy !== "add" && onClose()} size="lg">
      <ModalHeader onClose={() => busy !== "add" && onClose()}>
        <span className="flex items-center gap-2">
          <MonitorPlay className="h-5 w-5" /> Find a video with AI
        </span>
      </ModalHeader>
      <ModalBody className="space-y-4">
        {busy === "search" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading the topic and searching YouTube…
          </p>
        )}

        {result && busy !== "search" && (
          <>
            <div className="rounded-2xl bg-muted/60 p-4 text-sm">
              <p className="mb-1 flex items-center gap-2 font-semibold">
                <Sparkles className="h-4 w-4" /> What this topic&apos;s video should cover
              </p>
              <p className="text-muted-foreground">{result.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">Searched YouTube for “{result.query}”</p>
            </div>

            {all.length === 0 ? (
              <p className="text-sm text-muted-foreground">{result.reason || "No suitable videos found."} Try searching again.</p>
            ) : (
              <>
                {!result.video && (
                  <p className="text-sm text-amber-700">
                    The AI didn&apos;t think any result was a great match{result.reason ? `: ${result.reason}` : "."} Check the
                    videos below before adding one.
                  </p>
                )}
                <ul className="space-y-2" role="radiogroup" aria-label="Videos">
                  {all.map(v => {
                    const isPick = v.id === result.video?.id
                    const isSelected = v.id === selected
                    return (
                      <li key={v.id}>
                        <div
                          role="radio"
                          aria-checked={isSelected}
                          tabIndex={0}
                          onClick={() => setSelected(v.id)}
                          onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSelected(v.id))}
                          className={cn(
                            "flex cursor-pointer gap-3 rounded-2xl border p-2.5 transition-colors",
                            isSelected ? "border-foreground bg-muted/40" : "border-border hover:bg-muted/30"
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnails */}
                          <img src={v.thumbnail} alt="" className="h-[68px] w-[120px] shrink-0 rounded-xl object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-medium">{v.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {v.channel} · {minutes(v.seconds)} · {views(v.views)}
                            </p>
                            {isPick && (
                              <p className="mt-1 text-xs text-green-700">
                                <Check className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
                                AI&apos;s pick{result.reason ? `: ${result.reason}` : ""}
                              </p>
                            )}
                          </div>
                          <a
                            href={v.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={`Watch ${v.title} on YouTube`}
                            title="Watch on YouTube"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </>
        )}

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={() => void searchAgain()} disabled={busy !== null}>
          <RefreshCw className="h-4 w-4" />
          Search again
        </Button>
        <Button variant="primary" onClick={add} disabled={!chosen || busy !== null}>
          {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorPlay className="h-4 w-4" />}
          Add to lesson and save
        </Button>
      </ModalFooter>
    </Modal>
  )
}
