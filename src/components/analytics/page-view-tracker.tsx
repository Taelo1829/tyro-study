"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { trackEvent } from "@/lib/analytics-client"

/**
 * Records a "page_view" each time the page changes, plus "app_installed" when
 * the PWA is installed. The first view of a visit also notes where the visitor
 * came from (the referring site and any utm_source), for the traffic sources
 * table on the admin analytics page.
 */
export function PageViewTracker() {
  const pathname = usePathname()
  const first = useRef(true)

  useEffect(() => {
    if (!pathname) return
    const props: Record<string, string | boolean> = {}
    if (first.current) {
      first.current = false
      props.entry = true
      try {
        const ref = document.referrer ? new URL(document.referrer) : null
        if (ref && ref.host !== window.location.host) props.referrer = ref.host.replace(/^www\./, "")
        const utm = new URLSearchParams(window.location.search).get("utm_source")
        if (utm) props.utm_source = utm.slice(0, 60)
        if (window.matchMedia?.("(display-mode: standalone)").matches) props.standalone = true
      } catch {
        // ignore
      }
    }
    trackEvent("page_view", props, pathname)
  }, [pathname])

  useEffect(() => {
    const onInstalled = () => trackEvent("app_installed")
    window.addEventListener("appinstalled", onInstalled)
    return () => window.removeEventListener("appinstalled", onInstalled)
  }, [])

  return null
}
