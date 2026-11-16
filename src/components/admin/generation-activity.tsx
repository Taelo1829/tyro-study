"use client"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import type { GenerationJob } from "@/lib/generation-types"

export function GenerationActivity() {
  const [activeIds, setActiveIds] = useState<string[]>([])
  const dismissed = useRef(new Set<string>())
  const active = useRef<string[]>([])
  function persistDismissed() {
    try { sessionStorage.setItem("generation-dismissed", JSON.stringify([...dismissed.current])) } catch { /* Keep dismissal in memory when storage is unavailable. */ }
  }
  useEffect(() => {
    let mounted = true
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem("generation-dismissed") || "[]")
      if (Array.isArray(saved)) dismissed.current = new Set(saved.filter((id): id is string => typeof id === "string"))
    } catch { /* Storage is optional. */ }
    const refresh = async () => {
      try {
        const response = await fetch("/api/generation", { cache: "no-store" })
        if (!response.ok) return
        const jobs = await response.json() as GenerationJob[]
        if (!mounted) return
        active.current = jobs.filter(j => j.status === "QUEUED" || j.status === "RUNNING").map(j => j.id)
        setActiveIds(active.current.filter(id => !dismissed.current.has(id)))
      } catch { /* The saved job keeps running if this device is offline. */ }
    }
    const queued = (event: Event) => {
      const id: unknown = (event as CustomEvent).detail
      if (typeof id === "string") {
        // A newly queued job (including an explicit retry) can show progress again.
        dismissed.current.delete(id)
        persistDismissed()
        active.current = [...new Set([...active.current, id])]
        setActiveIds(active.current.filter(jobId => !dismissed.current.has(jobId)))
      }
      void refresh()
    }
    void refresh()
    const timer = setInterval(refresh, 10000)
    window.addEventListener("generation-queued", queued)
    return () => { mounted = false; clearInterval(timer); window.removeEventListener("generation-queued", queued) }
  }, [])
  if (!activeIds.length) return null
  return <aside className="fixed bottom-24 right-4 z-[200] max-w-xs rounded-xl border bg-background p-3 shadow-lg lg:bottom-4" aria-live="polite">
    <Link className="text-sm font-semibold underline" href={activeIds.length === 1 ? `/admin/generation?job=${encodeURIComponent(activeIds[0])}` : "/admin/generation"}>Generation progress · {activeIds.length} running</Link>
    <button type="button" className="ml-3 text-xs" onClick={() => {
      active.current.forEach(id => dismissed.current.add(id))
      persistDismissed()
      setActiveIds([])
    }}>Dismiss</button>
  </aside>
}
