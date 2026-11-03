/**
 * Structured logging. One JSON object per line, so Vercel → Logs can filter
 * by field (level, event, requestId) and a log drain can parse it later.
 *
 *   log.info("quiz.finished", { requestId, ms: 812, questions: 25 })
 *   log.error("reminders.failed", { err })
 *
 * Rules: no names, emails, passwords, tokens, message text or answers in logs
 * (POPIA). Use ids. `redact()` scrubs emails, bearer tokens and long secrets
 * from any string that does get logged (error messages, paths).
 *
 * Vercel Hobby keeps runtime logs for 1 hour, so anything that must be looked
 * at later goes to error_events (src/lib/monitoring.ts) as well.
 */

type Level = "debug" | "info" | "warn" | "error"
type Fields = Record<string, unknown> & { err?: unknown }

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi
const QUERY_SECRET = /([?&](?:key|token|secret|code|password|sig|signature)=)[^&\s]+/gi
const LONG_TOKEN = /\b[A-Za-z0-9_-]{32,}\b/g
const URL_CREDENTIALS = /(\w+:\/\/)[^/\s:@]+:[^/\s@]+@/g

/** First non-empty line of a message (Prisma errors start with a blank line). */
export function firstLine(text: string): string {
  return text.split("\n").map(l => l.trim()).find(Boolean) ?? ""
}

export function redact(text: string): string {
  return text
    .replace(URL_CREDENTIALS, "$1***:***@")
    .replace(EMAIL, "[email]")
    .replace(BEARER, "$1 [redacted]")
    .replace(QUERY_SECRET, "$1[redacted]")
    .replace(LONG_TOKEN, "[token]")
}

function errorFields(err: unknown) {
  if (err instanceof Error) {
    const digest = (err as Error & { digest?: unknown }).digest
    return {
      error: redact(firstLine(err.message).slice(0, 500)),
      errorName: err.name,
      ...(typeof digest === "string" ? { digest } : {}),
      ...(err.stack ? { stack: redact(err.stack.split("\n").slice(1, 6).join("\n")) } : {}),
    }
  }
  return err === undefined ? {} : { error: redact(String(err).slice(0, 500)) }
}

function write(level: Level, event: string, fields: Fields = {}) {
  const { err, ...rest } = fields
  const line = JSON.stringify({
    level,
    event,
    time: new Date().toISOString(),
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
    ...rest,
    ...errorFields(err),
  })
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else if (level === "debug") { if (process.env.LOG_DEBUG === "1") console.log(line) }
  else console.log(line)
}

export const log = {
  debug: (event: string, fields?: Fields) => write("debug", event, fields),
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
}

/** Vercel's id for this request (same id as in Vercel → Logs), for correlating log lines and errors. */
export function requestIdFrom(headers: Headers | Record<string, string | string[] | undefined> | null | undefined): string | null {
  if (!headers) return null
  const raw = headers instanceof Headers ? headers.get("x-vercel-id") : headers["x-vercel-id"]
  const value = Array.isArray(raw) ? raw[0] : raw
  return value ? value.slice(0, 120) : null
}

/**
 * Times an async step and logs it (and a warning above `slowMs`).
 *   const result = await timed("ai.generate", () => openai.chat(...), { requestId, slowMs: 8000 })
 */
export async function timed<T>(event: string, fn: () => Promise<T>, fields: Fields & { slowMs?: number } = {}): Promise<T> {
  const { slowMs = 2000, ...rest } = fields
  const started = performance.now()
  try {
    const result = await fn()
    const ms = Math.round(performance.now() - started)
    write(ms > slowMs ? "warn" : "info", event, { ...rest, ms, ...(ms > slowMs ? { slow: true } : {}) })
    return result
  } catch (err) {
    write("error", `${event}.failed`, { ...rest, ms: Math.round(performance.now() - started), err })
    throw err
  }
}
