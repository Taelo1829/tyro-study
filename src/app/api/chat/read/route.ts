import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pusherServer, conversationChannel, EVENTS, userChannel } from '@/lib/pusher'
import { getServerSession } from 'next-auth'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conversationId } = await req.json()
  if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

  // Only members of the conversation may mark its messages as read
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ user1Id: session.user.id }, { user2Id: session.user.id }],
    },
    select: { id: true },
  })
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: session.user.id },
      readAt: null,
    },
    data: { readAt: new Date() },
  })

  try {
    await pusherServer.trigger(
      conversationChannel(conversationId),
      EVENTS.MESSAGE_READ,
      { userId: session.user.id, conversationId }
    )

    await pusherServer.trigger(
      userChannel(session.user.id),
      EVENTS.MESSAGE_READ,
      { conversationId }
    )
  } catch (error) {
    // Messages are already marked read; a realtime hiccup shouldn't fail the request
    console.error('Pusher read-receipt error:', error)
  }

  return NextResponse.json({ success: true })
}
