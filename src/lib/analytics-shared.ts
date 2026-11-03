/**
 * Event names for product analytics, shared by the server (src/lib/analytics.ts)
 * and the browser (src/lib/analytics-client.ts). Safe to import on the client.
 *
 * Naming: object_verb in snake_case. Add new names here so the admin
 * analytics page and the /api/events allowlist know about them.
 */

/** Events recorded on the server, where the action actually happens */
export const SERVER_EVENTS = [
  "sign_up_started", // details sent, code emailed
  "sign_up", // code confirmed, account created
  "login",
  "module_joined",
  "module_left",
  "quiz_started",
  "quiz_completed", // props.passed, props.score, props.kind
  "push_enabled",
  "message_sent",
  "friend_request_sent",
  "friend_request_accepted",
  "assignment_submitted",
  "project_submitted",
  "exercise_checked",
  "feedback_sent", // props.kind, props.page (business/12)
] as const

/** Events the browser may send to POST /api/events */
export const CLIENT_EVENTS = [
  "page_view",
  "lesson_opened",
  "topic_tab_viewed",
  "app_installed",
  "web_vital", // performance sample: props.metric (LCP/INP/CLS/FCP/TTFB), value, rating, route (business/11)
] as const

export type ServerEventName = (typeof SERVER_EVENTS)[number]
export type ClientEventName = (typeof CLIENT_EVENTS)[number]
export type EventName = ServerEventName | ClientEventName

/** Extra details on an event: ids, counts, scores. Never names, emails or message text. */
export type EventProps = Record<string, string | number | boolean | null | undefined>

export function isClientEvent(name: unknown): name is ClientEventName {
  return typeof name === "string" && (CLIENT_EVENTS as readonly string[]).includes(name)
}

/** First-party cookie holding a random visitor id (for signed-out visits and sign-up conversion) */
export const ANON_COOKIE = "tyro_aid"

/** Keep props small and flat: at most 12 keys, short strings, no nested objects */
export function cleanProps(props: unknown): Record<string, string | number | boolean | null> | null {
  if (!props || typeof props !== "object" || Array.isArray(props)) return null
  const out: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(props as Record<string, unknown>).slice(0, 12)) {
    const k = key.slice(0, 40)
    if (value === null || typeof value === "boolean") out[k] = value
    else if (typeof value === "number" && Number.isFinite(value)) out[k] = value
    else if (typeof value === "string") out[k] = value.slice(0, 200)
  }
  return Object.keys(out).length ? out : null
}

/** "/modules/abc?x=1#y" → "/modules/abc" (query strings can hold tokens and emails) */
export function cleanPath(path: unknown): string | null {
  if (typeof path !== "string" || !path.startsWith("/")) return null
  return path.split(/[?#]/)[0].slice(0, 300)
}
