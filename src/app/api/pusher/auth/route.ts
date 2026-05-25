import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { pusherServer } from '@/lib/pusher'
import { getServerSession } from 'next-auth'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  console.log(session)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.text()
  const params = new URLSearchParams(body)
  const socketId = params.get('socket_id')
  const channelName = params.get('channel_name')

  if (!socketId || !channelName) {
    return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 })
  }

  // Only allow users to auth channels they belong to
  const userId = session.user.id

  // private-user-{userId} — only the owner
  if (channelName.startsWith('private-user-')) {
    const channelUserId = channelName.replace('private-user-', '')
    if (channelUserId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // private-conversation-{id} — verify user is in the conversation
  if (channelName.startsWith('private-conversation-')) {
    const { prisma } = await import('@/lib/prisma')
    const conversationId = channelName.replace('private-conversation-', '')
    const conv = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
    })
    if (!conv) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }
  console.log("channelname", channelName)
  if (channelName.startsWith('all-conversation-')) {
    const { prisma } = await import('@/lib/prisma')
    const userId = channelName.replace('all-conversation-', '')
    console.log(userId)
    const conv = await prisma.message.findMany({
      where: {
        readAt: null,
      },
    })
    if (!conv) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }
  const authResponse = pusherServer.authorizeChannel(socketId, channelName)
  return NextResponse.json(authResponse)
}