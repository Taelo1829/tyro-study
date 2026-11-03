import type { Instrumentation } from "next"

/**
 * Next.js calls onRequestError for every unhandled server error: route
 * handlers, server components, server actions and the proxy. We log it as one
 * structured line (Vercel → Logs) and group it in error_events so it's still
 * visible after Vercel's 1-hour log retention (Admin → Monitoring).
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const error = err as Error & { digest?: string }
  const requestId = (() => {
    const v = request.headers["x-vercel-id"]
    return (Array.isArray(v) ? v[0] : v) ?? null
  })()

  if (process.env.NEXT_RUNTIME !== "nodejs") {
    // Edge runtime: no database client here; the log line is the record.
    console.error(JSON.stringify({ level: "error", event: "request.error", runtime: "edge", path: request.path.split("?")[0], route: context.routePath, error: String(error?.message ?? error).slice(0, 300), requestId }))
    return
  }

  const { log } = await import("@/lib/log")
  const { recordError } = await import("@/lib/monitoring")
  log.error("request.error", {
    err: error,
    method: request.method,
    path: request.path.split("?")[0],
    route: context.routePath,
    routeType: context.routeType,
    requestId,
  })
  // Don't hold the response for long if the database is slow.
  await Promise.race([
    recordError({
      source: "server",
      name: error?.name,
      message: String(error?.message ?? error),
      route: context.routePath,
      requestId,
      digest: error?.digest ?? null,
    }),
    new Promise(resolve => setTimeout(resolve, 1500)),
  ])
}
