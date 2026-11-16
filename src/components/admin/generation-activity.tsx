"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import type { GenerationJob } from "@/lib/generation-types"

export function GenerationActivity() {
  const [active, setActive] = useState(0)
  const [notice, setNotice] = useState("")
  const [noticeJob, setNoticeJob] = useState<string | null>(null)
  useEffect(() => {
    let mounted = true
    const refresh = async () => {
      try {
        const response = await fetch("/api/generation", { cache: "no-store" })
        if (!response.ok) return
        const jobs = await response.json() as GenerationJob[]
        if (!mounted) return
        setActive(jobs.filter(j => j.status === "QUEUED" || j.status === "RUNNING").length)
        const latest = jobs.filter(j => j.status === "COMPLETED" || j.status === "FAILED").sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
        if (latest && localStorage.getItem("generation-notice") !== `${latest.id}:${latest.status}`) {
          setNotice(latest.status === "COMPLETED" ? `${latest.title} is ready` : `${latest.title} needs attention`)
          setNoticeJob(latest.id)
          localStorage.setItem("generation-notice", `${latest.id}:${latest.status}`)
        }
      } catch { /* The saved job keeps running if this device is offline. */ }
    }
    const queued = () => { setNotice("Generation started. You can leave this page or close the app."); setNoticeJob(null); void refresh() }
    void refresh()
    const timer = setInterval(refresh, 10000)
    window.addEventListener("generation-queued", queued)
    return () => { mounted = false; clearInterval(timer); window.removeEventListener("generation-queued", queued) }
  }, [])
  return <aside className="fixed bottom-24 right-4 z-[200] max-w-xs rounded-xl border bg-background p-3 shadow-lg lg:bottom-4" aria-live="polite">
    {notice && <p className="mb-2 text-sm">{notice}</p>}
    <Link className="text-sm font-semibold underline" href={noticeJob ? `/admin/generation?job=${encodeURIComponent(noticeJob)}` : "/admin/generation"}>Generation progress{active ? ` · ${active} running` : ""}</Link>
    {notice && <button className="ml-3 text-xs" onClick={() => setNotice("")}>Dismiss</button>}
  </aside>
}
