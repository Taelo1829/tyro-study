import { NextRequest, NextResponse } from 'next/server'
import { pusherServer, conversationChannel, EVENTS } from '@/lib/pusher'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conversationId, isTyping } = await req.json()
  if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

  await pusherServer.trigger(
    conversationChannel(conversationId),
    isTyping ? EVENTS.TYPING_START : EVENTS.TYPING_STOP,
    { userId: session.user.id, name: session.user.name }
  )

  return NextResponse.json({ success: true })
}
