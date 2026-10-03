import { NextRequest, NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"

/**
 * POST - heartbeat: stamp the signed-in user's lastSeen (sent every minute
 * while the app is open, and via sendBeacon when the page is hidden/closed).
 * Raw SQL so the frequent ping doesn't also bump users.updatedAt.
 */
export async function POST() {
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await prisma.$executeRaw`
    UPDATE "users" SET "lastSeen" = NOW() AT TIME ZONE 'UTC' WHERE "id" = ${userId}
  `
  return new NextResponse(null, { status: 204 })
}

/**
 * GET ?ids=a,b - lastSeen for people you have a conversation with (used when
 * live presence isn't available). Anyone else is left out.
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map(id => id.trim())
    .filter(Boolean)
    .slice(0, 50)
  if (ids.length === 0) return NextResponse.json({ lastSeen: {} })

  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [
        { user1Id: userId, user2Id: { in: ids } },
        { user2Id: userId, user1Id: { in: ids } },
      ],
    },
    select: {
      user1: { select: { id: true, lastSeen: true } },
      user2: { select: { id: true, lastSeen: true } },
    },
  })

  const lastSeen: Record<string, string | null> = {}
  for (const c of conversations) {
    const other = c.user1.id === userId ? c.user2 : c.user1
    lastSeen[other.id] = other.lastSeen?.toISOString() ?? null
  }
  return NextResponse.json({ lastSeen }, { headers: { "Cache-Control": "no-store" } })
}
