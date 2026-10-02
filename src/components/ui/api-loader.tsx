"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { getApiPending, installApiLoadingTracker, subscribeApiLoading } from "@/lib/api-loading"

// Install as early as possible on the client so the first page's calls count too
if (typeof window !== "undefined") installApiLoadingTracker()

/** Wait this long before showing, so instant responses don't flash the bar */
const SHOW_DELAY_MS = 150

/**
 * Thin animated bar across the top of the screen while any /api call is in
 * flight (see lib/api-loading). Mounted once in the root layout.
 */
export function ApiLoader() {
  const pending = useSyncExternalStore(subscribeApiLoading, getApiPending, () => 0)
  const busy = pending > 0
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(busy), busy ? SHOW_DELAY_MS : 250)
    return () => clearTimeout(timer)
  }, [busy])

  const show = busy && visible

  return (
    <div
      role="progressbar"
      aria-label="Loading"
      aria-hidden={!show}
      aria-busy={show}
      className={`api-loader pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden transition-opacity duration-300 ${show ? "opacity-100" : "opacity-0"}`}
    >
      <div className="api-loader-bar h-full w-1/3 rounded-full bg-accent shadow-[0_0_8px_var(--neo-accent,#4cb2f5)]" />
    </div>
  )
}
