"use client"

import { useEffect } from "react"
import { reportClientError } from "@/lib/report-client-error"

/**
 * Last-resort screen when the root layout itself fails. Must render its own
 * <html> and <body> and can't rely on app styles or components.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, { digest: error.digest, source: "global-error" })
  }, [error])

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, padding: 16, textAlign: "center" }}>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 24 }}>Tyro Study is having a problem</h1>
          <p>Your progress is saved. Please try again in a minute.</p>
          <button onClick={reset} style={{ padding: "12px 20px", fontSize: 16, borderRadius: 12, border: "1px solid #ccc", background: "#111", color: "#fff", minHeight: 44 }}>
            Try again
          </button>
          {error.digest && <p style={{ fontSize: 12, color: "#666" }}>Reference: {error.digest}</p>}
        </div>
      </body>
    </html>
  )
}
