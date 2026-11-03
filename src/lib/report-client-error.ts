/**
 * Browser side of error tracking: sends uncaught errors and crashed pages to
 * /api/client-errors, which groups them with server errors (Admin → Monitoring).
 *
 * Sends only the error name, first line of the message, the page path and the
 * Next.js digest. Never form contents, names or emails. Noise from browser
 * extensions, ad scripts and cross-origin scripts is dropped here.
 *
 * Safe to import in client components.
 */

const IGNORE = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i, // cross-origin script, no details
  /chrome-extension:|moz-extension:|safari-extension:/i,
  /adsbygoogle|googlesyndication|pagead/i,
  /Load failed|Failed to fetch|NetworkError|network error/i, // offline / flaky network, not a bug
  /AbortError|The user aborted/i,
  /Non-Error promise rejection captured/i,
]

const sent = new Set<string>()
let count = 0
const MAX_PER_PAGE_LOAD = 5

export function reportClientError(error: unknown, extra: { digest?: string; source?: string } = {}) {
  if (typeof window === "undefined") return
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error")
  const message = (err.message || "").split("\n")[0].slice(0, 300)
  const stackTop = err.stack?.split("\n").slice(0, 3).join("\n") ?? ""
  if (!message || IGNORE.some(re => re.test(message) || re.test(stackTop))) return
  const key = `${err.name}:${message}`
  if (sent.has(key) || count >= MAX_PER_PAGE_LOAD) return
  sent.add(key)
  count++
  const body = JSON.stringify({
    name: err.name.slice(0, 80),
    message,
    path: window.location.pathname,
    digest: extra.digest ?? (err as Error & { digest?: string }).digest,
    source: extra.source,
  })
  try {
    if (navigator.sendBeacon?.("/api/client-errors", new Blob([body], { type: "application/json" }))) return
  } catch {
    /* fall through */
  }
  fetch("/api/client-errors", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {})
}

/** Global handlers for errors outside React (event handlers, timers, promises). */
export function installGlobalErrorHandlers() {
  if (typeof window === "undefined" || (window as Window & { __tyroErrors?: boolean }).__tyroErrors) return
  ;(window as Window & { __tyroErrors?: boolean }).__tyroErrors = true
  window.addEventListener("error", e => reportClientError(e.error ?? e.message, { source: "window.error" }))
  window.addEventListener("unhandledrejection", e => reportClientError(e.reason, { source: "unhandledrejection" }))
}
