"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import type { GenerationJob } from "@/lib/generation-types"
import { askForNotificationsOnTap, usePushNotifications } from "@/hooks/use-push-notifications"
import { generationReviewAction } from "@/lib/generation-review"
import { sanitizeTopicHtml } from "@/lib/topic-content"

type Summary = Omit<GenerationJob, "tasks" | "results"> & { total: number }
export function GenerationHistory() {
  const router = useRouter()
  const selected = useSearchParams().get("job")
  const [jobs, setJobs] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<GenerationJob | null>(null)
  const [error, setError] = useState("")
  const [reviewed, setReviewed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const push = usePushNotifications()
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const response = await fetch("/api/generation", { cache: "no-store" })
        if (!response.ok) throw new Error("Could not load generation activity")
        const rows = await response.json()
        if (active) setJobs(rows)
      } catch (error) { if (active) setError(error instanceof Error ? error.message : "Could not load jobs") }
      finally { if (active) setLoading(false) }
    }
    void load()
    const timer = setInterval(load, 5000)
    return () => { active = false; clearInterval(timer) }
  }, [])
  useEffect(() => {
    if (!selected) return
    let active = true
    async function refresh() {
      try {
        const response = await fetch(`/api/generation?id=${encodeURIComponent(selected!)}`, { cache: "no-store" })
        if (!response.ok) throw new Error("Could not load this job")
        const job = await response.json()
        if (active) {
          setDetail(job)
          if (!job) setError("This job was not found or is not available to your account.")
        }
      } catch (error) { if (active) setError(error instanceof Error ? error.message : "Could not load this job") }
    }
    void refresh()
    const timer = setInterval(refresh, 5000)
    return () => { active = false; clearInterval(timer) }
  }, [selected])
  async function open(id: string) {
    setReviewed(false); setSaved(false); setError("")
    if (id !== selected) setDetail(null)
    router.push(`/admin/generation?job=${encodeURIComponent(id)}#generation-detail`, { scroll: true })
  }
  function download(job: GenerationJob) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(job.results, null, 2)], { type: "application/json" }))
    const link = document.createElement("a"); link.href = url; link.download = `generation-${job.id}.json`; link.click(); URL.revokeObjectURL(url)
  }
  const action = detail ? generationReviewAction(detail) : null
  async function apply() {
    if (!action || !reviewed) return
    setSaving(true); setError("")
    try {
      const response = await fetch(action.path, { method: action.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(action.body) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not save the reviewed content")
      setSaved(true)
    } catch (error) { setError(error instanceof Error ? error.message : "Save failed") }
    finally { setSaving(false) }
  }
  async function retry(id: string) {
    try {
      const response = await fetch("/api/generation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ retryId: id }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      window.dispatchEvent(new CustomEvent("generation-queued", { detail: id }))
      await open(id)
    } catch (error) { setError(error instanceof Error ? error.message : "Could not retry") }
  }
  return <div className="space-y-5">
    <Link href="/admin" className="text-sm underline">Back to admin</Link>
    <h1 className="text-2xl font-bold">Generation progress</h1>
    <p>Work continues on the server when you leave or close the app. Results and drafts are saved here. Review drafts before applying them.</p>
    <p className="text-sm text-muted-foreground">Progress refreshes every 5 seconds. Steps may be added as documents are analysed.</p>
    {!push.enabled && <Button onClick={() => void askForNotificationsOnTap()}>Enable completion notifications</Button>}
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {loading ? <p role="status">Loading generation jobs…</p> : !jobs.length && <p>No generation jobs yet.</p>}
    {selected && !detail && !error && <p id="generation-detail" role="status">Loading selected job…</p>}
    {detail && detail.id === selected && <section id="generation-detail" className="scroll-mt-6 space-y-3 rounded-xl border p-4">
      <h2 className="text-lg font-semibold">{detail.title}</h2>
      <JobProgress status={detail.status} cursor={detail.cursor} total={detail.tasks.length} />
      <p className="text-sm text-muted-foreground">Last updated: {new Date(detail.updatedAt).toLocaleString()}</p>
      {detail.error && <p role="alert" className="text-red-600">{detail.error}</p>}
      <ol className="max-h-72 space-y-2 overflow-auto rounded border p-3 text-sm" aria-label="Generation steps">
        {detail.tasks.map((task, index) => <li key={index}>
          <span className="font-medium">{index < detail.cursor ? "Completed" : index === detail.cursor && detail.status === "RUNNING" ? "Processing" : index === detail.cursor && detail.status === "FAILED" ? "Failed" : "Queued"}</span>
          {" · "}{task.label || `Step ${index + 1}`}
        </li>)}
      </ol>
      <Button size="sm" onClick={() => download(detail)}>Download results</Button>
      {detail.status === "FAILED" && <Button size="sm" onClick={() => void retry(detail.id)}>Retry unfinished steps</Button>}
      {detail.results.map((result, i) => <details key={i} className="rounded border p-3">
        <summary>{result.task.label || `Step ${i + 1}`} — saved result</summary>
        <SavedGenerationResult data={result.data} />
        <Button size="sm" onClick={() => { sessionStorage.setItem("generation-restore", JSON.stringify(result)); setError("Result ready to restore. Open its editor and select Generate again with the same inputs to load the saved result.") }}>Use in original editor</Button>
        {result.task.path.match(/\/admin\/modules\/([^/]+)/)?.[1] && <Link className="ml-3 underline" href={`/modules/${result.task.path.match(/\/admin\/modules\/([^/]+)/)![1]}`}>Open module</Link>}
      </details>)}
      {action && !saved && <div className="space-y-3 rounded border p-3">
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I reviewed all saved drafts and answer keys above. {action.label}. This updates content for students.</label>
        <Button disabled={!reviewed || saving} onClick={() => void apply()}>{saving ? "Saving…" : action.label}</Button>
      </div>}
      {saved && <p role="status">Reviewed content saved.</p>}
    </section>}
    {jobs.map(job => <section key={job.id} className="rounded-xl border p-4">
      <h2 className="font-semibold">{job.title}</h2>
      <JobProgress status={job.status} cursor={job.cursor} total={job.total} />
      {job.error && <p className="mt-2 text-sm text-red-600">{job.error}</p>}
      <Button size="sm" onClick={() => void open(job.id)}>View progress and results</Button>
    </section>)}
  </div>
}

function JobProgress({ status, cursor, total }: { status: GenerationJob["status"]; cursor: number; total: number }) {
  return <div className="my-2 space-y-1">
    <p className="text-sm"><span className="capitalize">{status.toLowerCase()}</span> · {cursor} / {total} steps complete</p>
    <progress className="h-2 w-full accent-primary" aria-label="Completed generation steps" value={cursor} max={Math.max(total, 1)} />
  </div>
}

function SavedGenerationResult({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") return <p>{String(data ?? "Done")}</p>
  const value = data as { html?: string; questions?: { question: string; options?: string[]; correctOption?: string; modelAnswer?: string }[]; note?: string; moduleId?: string; source?: unknown }
  return <div className="mt-3 space-y-3">
    {value.html && <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeTopicHtml(value.html) }} />}
    {value.questions?.map((q, i) => <details key={i}><summary>{i + 1}. {q.question}</summary>{q.options?.map((option, j) => <p key={j}>{option === q.correctOption ? "✓ " : ""}{option}</p>)}{q.modelAnswer && <p className="whitespace-pre-wrap">{q.modelAnswer}</p>}</details>)}
    {value.note && <p>{value.note}</p>}
    {value.moduleId && <Link className="underline" href={`/modules/${value.moduleId}`}>Open module</Link>}
    <details><summary className="text-sm">All saved details</summary><pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(data, null, 2)}</pre></details>
  </div>
}
