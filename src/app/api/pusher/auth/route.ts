import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { PRESENCE_CHANNEL, pusherServer } from '@/lib/pusher'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.text()
  const params = new URLSearchParams(body)
  const socketId = params.get('socket_id')
  const channelName = params.get('channel_name')

  if (!socketId || !channelName) {
    return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 })
  }

  const userId = session.user.id

  // presence-online — any signed-in user joins as themselves (powers "Online")
  if (channelName === PRESENCE_CHANNEL) {
    return NextResponse.json(
      pusherServer.authorizeChannel(socketId, channelName, { user_id: userId })
    )
  }

  // private-user-{userId} — only the owner
  if (channelName.startsWith('private-user-')) {
    const channelUserId = channelName.slice('private-user-'.length)
    if (channelUserId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json(pusherServer.authorizeChannel(socketId, channelName))
  }

  // private-conversation-{id} — verify user is in the conversation
  if (channelName.startsWith('private-conversation-')) {
    const conversationId = channelName.slice('private-conversation-'.length)
    const conv = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      select: { id: true },
    })
    if (!conv) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json(pusherServer.authorizeChannel(socketId, channelName))
  }

  // Any other channel name is not one this app uses — refuse it rather than
  // authorising arbitrary private channels for any signed-in user.
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
