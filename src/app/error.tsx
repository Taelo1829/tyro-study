"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { reportClientError } from "@/lib/report-client-error"

/**
 * Shown when a page crashes. Reports the error (Admin → Monitoring) and lets
 * the student retry without losing the rest of the app. The reference is the
 * Next.js digest, which matches the server log line if the error came from
 * the server, so a student can quote it.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, { digest: error.digest, source: "error-boundary" })
  }, [error])

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground">
        This page couldn&apos;t load. Your progress is saved. Try again, or go back to your dashboard.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
      {error.digest && <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>}
      <Link href="/feedback?kind=bug" className="text-sm underline">Tell us what you were doing</Link>
    </main>
  )
}
