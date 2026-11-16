"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SyncPaperLessons({ moduleId }: { moduleId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function start() {
    setBusy(true); setError("")
    try {
      const response = await fetch(`/api/admin/modules/${moduleId}/sync-papers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start" }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not start paper sync")
      window.dispatchEvent(new CustomEvent("generation-queued", { detail: data.id }))
      router.push(`/admin/generation?job=${encodeURIComponent(data.id)}`)
    } catch (error) { setError(error instanceof Error ? error.message : "Could not start paper sync") }
    finally { setBusy(false) }
  }
  return <div>
    <Button size="sm" variant="outline" disabled={busy} onClick={() => void start()} title="Prepare lesson updates from previously uploaded paper questions, then review and apply them in Generation progress.">
      <RefreshCw className={`h-4 w-4${busy ? " animate-spin" : ""}`} />
      {busy ? "Queueing paper sync…" : "Sync paper questions to lessons"}
    </Button>
    {error && <p role="alert" className="max-w-sm text-sm text-red-600">{error}</p>}
  </div>
}
