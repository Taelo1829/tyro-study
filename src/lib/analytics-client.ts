"use client"

import type { ClientEventName, EventProps } from "@/lib/analytics-shared"

/**
 * Record a product analytics event from the browser. Fire and forget: uses
 * sendBeacon so the event still arrives when the page is closing, and never
 * throws. The server adds the signed-in user and visitor id itself.
 *
 *   trackEvent("lesson_opened", { topicId })
 */
export function trackEvent(name: ClientEventName, props?: EventProps, path?: string) {
  if (typeof window === "undefined") return
  try {
    const body = JSON.stringify({ name, props, path: path ?? window.location.pathname })
    const blob = new Blob([body], { type: "application/json" })
    if (navigator.sendBeacon?.("/api/events", blob)) return
    void fetch("/api/events", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Analytics must never break the page
  }
}
