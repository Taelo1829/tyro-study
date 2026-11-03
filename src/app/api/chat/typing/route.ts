import { NextRequest, NextResponse } from 'next/server'
import { pusherServer, conversationChannel, EVENTS } from '@/lib/pusher'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { captureError } from "@/lib/monitoring"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conversationId, isTyping } = await req.json()
  if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

  // Only members of the conversation may broadcast typing events into it
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ user1Id: session.user.id }, { user2Id: session.user.id }],
    },
    select: { id: true },
  })
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    await pusherServer.trigger(
      conversationChannel(conversationId),
      isTyping ? EVENTS.TYPING_START : EVENTS.TYPING_STOP,
      { userId: session.user.id, name: session.user.name }
    )
  } catch (error) {
    captureError('Pusher typing error', error, "/api/chat/typing")
  }

  return NextResponse.json({ success: true })
}
