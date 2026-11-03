import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { track } from "@/lib/analytics"
import { isAllowedPushEndpoint } from "@/lib/push-endpoint"

interface BrowserPushSubscription {
  endpoint?: string
  keys?: {
    p256dh?: string
    auth?: string
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const subscription = (await request.json()) as BrowserPushSubscription
  const endpoint = subscription.endpoint
  const p256dh = subscription.keys?.p256dh
  const auth = subscription.keys?.auth

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 })
  }
  // The server will POST to this URL later, so only browser push services are allowed
  if (!isAllowedPushEndpoint(endpoint) || p256dh.length > 200 || auth.length > 100) {
    return NextResponse.json({ error: "Unsupported push service" }, { status: 400 })
  }

  const known = await prisma.pushSubscription.findUnique({ where: { endpoint }, select: { id: true } })

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: session.user.id,
      endpoint,
      p256dh,
      auth,
    },
    update: {
      userId: session.user.id,
      p256dh,
      auth,
    },
  })

  if (!known) track("push_enabled", { userId: session.user.id })

  return NextResponse.json({ success: true })
}
