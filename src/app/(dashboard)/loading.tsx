import { Loader2 } from "lucide-react"

/** Shown while a dashboard page is loading on the server (page transitions) */
export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </span>
      <p className="text-sm font-medium">Loading…</p>
    </div>
  )
}
