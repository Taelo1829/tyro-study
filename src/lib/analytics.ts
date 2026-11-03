import { randomUUID } from "crypto"
import { after } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { isEnabled } from "@/lib/flags"
import { ANON_COOKIE, cleanPath, cleanProps, type EventName, type EventProps } from "@/lib/analytics-shared"

export type { EventName, EventProps } from "@/lib/analytics-shared"

interface TrackOptions {
  userId?: string | null
  props?: EventProps
  path?: string | null
  /** Visitor id; read from the tyro_aid cookie when not given */
  anonId?: string | null
}

/** Write one event row. Never throws: analytics must not break the app. */
export async function writeEvent(name: EventName, { userId, props, path, anonId }: TrackOptions = {}) {
  if (!isEnabled("analytics")) return // kill switch: FLAG_ANALYTICS=off
  try {
    const json = cleanProps(props)
    await prisma.$executeRaw`
      INSERT INTO "analytics_events" ("id", "name", "userId", "anonId", "path", "props")
      VALUES (${randomUUID()}, ${name}, ${userId ?? null}, ${anonId ?? null}, ${cleanPath(path)},
              ${json ? JSON.stringify(json) : null}::jsonb)`
  } catch (err) {
    // Most likely the analytics migration hasn't been run yet
    console.warn(`Analytics event "${name}" not saved:`, err instanceof Error ? err.message.split("\n").pop() : err)
  }
}

async function anonIdFromCookie(): Promise<string | null> {
  try {
    return (await cookies()).get(ANON_COOKIE)?.value?.slice(0, 64) ?? null
  } catch {
    return null // not inside a request
  }
}

/**
 * Record a product analytics event from server code (route handlers, server
 * components, NextAuth callbacks). The insert runs after the response is sent,
 * so it never slows the user down, and errors are only logged.
 *
 *   track("module_joined", { userId, props: { moduleId } })
 */
export function track(name: EventName, options: TrackOptions = {}): void {
  // Read the cookie now, while still inside the request
  const anonId = options.anonId !== undefined ? Promise.resolve(options.anonId) : anonIdFromCookie()
  const write = async () => writeEvent(name, { ...options, anonId: await anonId })
  try {
    after(write)
  } catch {
    // Outside a request (scripts, tests): write straight away
    void write()
  }
}
