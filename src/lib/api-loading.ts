"use client"

/**
 * Counts in-flight calls to this app's /api routes so a single global loader
 * can show while anything is being waited on. Installed once by <ApiLoader />
 * by wrapping window.fetch — no changes needed at each call site.
 *
 * Background calls the user isn't waiting for (heartbeats, typing pings,
 * session refresh, unread badge) are skipped: either by URL below or by
 * calling `quietFetch` instead of `fetch`.
 */

const QUIET = Symbol.for("tyro.quietFetch")

const BACKGROUND_PATHS = [
  "/api/auth/session",
  "/api/auth/_log",
  "/api/presence",
  "/api/chat/typing",
  "/api/chat/read",
  "/api/pusher/auth",
]

let pending = 0
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function subscribeApiLoading(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getApiPending() {
  return pending
}

/** fetch() that never triggers the global loader */
export function quietFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, Object.assign({}, init, { [QUIET]: true }))
}

function shouldTrack(input: RequestInfo | URL, init?: RequestInit) {
  if (init && (init as Record<symbol, unknown>)[QUIET]) return false
  let url: URL
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    url = new URL(raw, window.location.href)
  } catch {
    return false
  }
  if (url.origin !== window.location.origin) return false
  if (!url.pathname.startsWith("/api/")) return false
  return !BACKGROUND_PATHS.some(path => url.pathname === path || url.pathname.startsWith(`${path}/`))
}

let installed = false

export function installApiLoadingTracker() {
  if (installed || typeof window === "undefined") return
  installed = true
  const original = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!shouldTrack(input, init)) return original(input, init)
    pending += 1
    emit()
    try {
      return await original(input, init)
    } finally {
      pending = Math.max(0, pending - 1)
      emit()
    }
  }
}
