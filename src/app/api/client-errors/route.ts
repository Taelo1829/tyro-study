import { NextResponse, type NextRequest } from "next/server"
import { recordError, routeTemplate } from "@/lib/monitoring"
import { log, requestIdFrom } from "@/lib/log"

const BOT = /bot|crawl|spider|slurp|preview|lighthouse|headless/i

/**
 * POST { name, message, path, digest?, source? } from src/lib/report-client-error.ts.
 * Public (errors happen before and after sign-in), so it's strict: small bodies
 * only, strings trimmed, bots ignored, and recordError caps how many new error
 * groups can appear per hour. Always answers 204 so it reveals nothing.
 */
export async function POST(request: NextRequest) {
  const res = new NextResponse(null, { status: 204 })
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return new NextResponse(null, { status: 413 })
  if (BOT.test(request.headers.get("user-agent") ?? "")) return res
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body.message !== "string" || !body.message.trim()) return res

  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null)
  const path = str(body.path, 300)
  const requestId = requestIdFrom(request.headers)
  const route = routeTemplate(path?.startsWith("/") ? path : null)
  log.warn("client.error", { name: str(body.name, 80), error: str(body.message, 300), route, source: str(body.source, 40), requestId })
  await recordError({
    source: "client",
    name: str(body.name, 80) ?? "Error",
    message: str(body.message, 300) ?? "",
    route,
    requestId,
    digest: str(body.digest, 64),
  })
  return res
}
