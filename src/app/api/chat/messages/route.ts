import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pusherServer, conversationChannel, EVENTS, userChannel } from '@/lib/pusher'
import { getServerSession } from 'next-auth'
import { sendChatPushNotifications } from '@/lib/web-push'

const messageInclude = {
  sender: { select: { id: true, name: true, email: true, image: true } },
  replyTo: {
    select: {
      id: true,
      senderId: true,
      type: true,
      content: true,
      mediaUrl: true,
      mediaDuration: true,
      sender: { select: { id: true, name: true, email: true, image: true } },
    },
  },
}

// GET /api/chat/messages?conversationId=xxx&cursor=xxx
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const conversationId = searchParams.get('conversationId')
  const cursor = searchParams.get('cursor')
  const limit = 40

  if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

  // Verify user is in this conversation
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ user1Id: session.user.id }, { user2Id: session.user.id }],
    },
  })
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const messages = await prisma.message.findMany({
    where: { conversationId },
    include: messageInclude,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = messages.length > limit
  if (hasMore) messages.pop()

  return NextResponse.json({
    messages: messages.reverse(),
    hasMore,
    nextCursor: hasMore ? messages[0].id : null,
  })
}

// POST /api/chat/messages — send a message
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { conversationId, content, type = 'TEXT', mediaUrl, mediaDuration, replyToId } = body

  if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })
  if (type === 'TEXT' && !content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 })
  if (type !== 'TEXT' && !mediaUrl) return NextResponse.json({ error: 'mediaUrl required for media messages' }, { status: 400 })

  // Verify user is in this conversation
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ user1Id: session.user.id }, { user2Id: session.user.id }],
    },
  })
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let validReplyToId: string | null = null
  if (replyToId) {
    if (typeof replyToId !== 'string') {
      return NextResponse.json({ error: 'replyToId must be a string' }, { status: 400 })
    }

    const replyTo = await prisma.message.findFirst({
      where: { id: replyToId, conversationId },
      select: { id: true },
    })

    if (!replyTo) {
      return NextResponse.json({ error: 'replyTo message not found' }, { status: 400 })
    }

    validReplyToId = replyTo.id
  }

  const [message] = await Promise.all([
    prisma.message.create({
      data: {
        conversationId,
        senderId: session.user.id,
        type,
        content: content?.trim() ?? null,
        mediaUrl: mediaUrl ?? null,
        mediaDuration: mediaDuration ?? null,
        replyToId: validReplyToId,
      },
      include: messageInclude,
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ])

  // Broadcast to both users in real-time
  await pusherServer.trigger(
    conversationChannel(conversationId),
    EVENTS.NEW_MESSAGE,
    message
  )

  const recipientId =
    conversation.user1Id === session.user.id ? conversation.user2Id : conversation.user1Id

  await pusherServer.trigger(
    userChannel(recipientId),
    EVENTS.NEW_MESSAGE,
    { conversationId, message }
  )

  await sendChatPushNotifications(recipientId)

  return NextResponse.json(message, { status: 201 })
}
