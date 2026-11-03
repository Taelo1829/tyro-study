import { randomUUID } from "crypto"
import { NextResponse, after, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { writeEvent } from "@/lib/analytics"
import { isEnabled } from "@/lib/flags"
import { ANON_COOKIE, cleanPath, isClientEvent } from "@/lib/analytics-shared"

const BOT = /bot|crawl|spider|slurp|preview|lighthouse|headless|facebookexternalhit|whatsapp/i
const YEAR = 60 * 60 * 24 * 365

/**
 * POST { name, props?, path? } from src/lib/analytics-client.ts.
 * Only names in CLIENT_EVENTS are accepted. The user comes from the session
 * (never from the body), and signed-out visitors get a random id cookie.
 */
export async function POST(request: NextRequest) {
  // Events are tiny; refuse anything big so the endpoint can't be used to fill the database
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return new NextResponse(null, { status: 413 })
  if (!isEnabled("analytics")) return new NextResponse(null, { status: 204 }) // kill switch: no cookie, no row
  const body = (await request.json().catch(() => null)) as { name?: unknown; props?: unknown; path?: unknown } | null
  const res = new NextResponse(null, { status: 204 })
  if (!body || !isClientEvent(body.name)) return res
  if (BOT.test(request.headers.get("user-agent") ?? "")) return res

  let anonId = request.cookies.get(ANON_COOKIE)?.value?.slice(0, 64) ?? null
  if (!anonId) {
    anonId = randomUUID()
    res.cookies.set(ANON_COOKIE, anonId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: YEAR, secure: request.nextUrl.protocol === "https:" })
  }

  const session = await getServerSession(authOptions).catch(() => null)
  const name = body.name
  const props = body.props && typeof body.props === "object" ? (body.props as Record<string, string | number | boolean | null>) : undefined
  const path = cleanPath(body.path)
  const userId = session?.user?.id ?? null
  after(() => writeEvent(name, { userId, anonId, path, props }))
  return res
}
