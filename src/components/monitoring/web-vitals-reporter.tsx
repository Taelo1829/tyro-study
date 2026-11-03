"use client"

import { useReportWebVitals } from "next/web-vitals"
import { trackEvent } from "@/lib/analytics-client"
import { routeTemplate } from "@/lib/route-template"

// Half of page loads report, to keep the events table small. Decided once per load.
const SAMPLE_RATE = 0.5
const sampled = typeof window !== "undefined" && Math.random() < SAMPLE_RATE
const KEEP = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"])

/**
 * Real-user performance (Core Web Vitals) from students' own phones, stored as
 * "web_vital" analytics events and summarised on Admin → Monitoring as p75 per
 * metric and page. Targets (business/02 NFR-01): LCP ≤ 2.5 s, INP ≤ 200 ms,
 * CLS ≤ 0.1 at the 75th percentile.
 */
export function WebVitalsReporter() {
  useReportWebVitals(metric => {
    if (!sampled || !KEEP.has(metric.name)) return
    trackEvent("web_vital", {
      metric: metric.name,
      value: metric.name === "CLS" ? Math.round(metric.value * 1000) / 1000 : Math.round(metric.value),
      rating: metric.rating,
      route: routeTemplate(window.location.pathname),
      nav: metric.navigationType,
    })
  })
  return null
}
