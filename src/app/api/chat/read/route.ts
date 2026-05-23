import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pusherServer, conversationChannel, EVENTS } from '@/lib/pusher'
import { getServerSession } from 'next-auth'

export async function POST(req: NextRequest) {
   const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conversationId } = await req.json()
  if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

  await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: session.user.id },
      readAt: null,
    },
    data: { readAt: new Date() },
  })

  await pusherServer.trigger(
    conversationChannel(conversationId),
    EVENTS.MESSAGE_READ,
    { userId: session.user.id, conversationId }
  )

  return NextResponse.json({ success: true })
}
