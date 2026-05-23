import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pusherServer, userChannel, EVENTS } from '@/lib/pusher'

// GET /api/chat/friends  — list friends + pending requests
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') // 'friends' | 'pending' | 'users'

  if (type === 'users') {
    // All users except self, with friendship status
    const [users, friendships] = await Promise.all([
      prisma.user.findMany({
        where: { id: { not: userId } },
        select: { id: true, name: true, email: true, image: true, role: true },
        orderBy: { name: 'asc' },
      }),
      prisma.friendship.findMany({
        where: {
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
      }),
    ])

    const friendMap = new Map(
      friendships.map(f => {
        const otherId = f.senderId === userId ? f.receiverId : f.senderId
        return [otherId, { status: f.status, isSender: f.senderId === userId, id: f.id }]
      })
    )

    return NextResponse.json(users.map(u => ({
      ...u,
      friendship: friendMap.get(u.id) ?? null,
    })))
  }

  if (type === 'pending') {
    // Requests received by me that are still pending
    const pending = await prisma.friendship.findMany({
      where: { receiverId: userId, status: 'PENDING' },
      include: { sender: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(pending)
  }

  // Default: accepted friends with their conversation id
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ senderId: userId }, { receiverId: userId }],
      status: 'ACCEPTED',
    },
    include: {
      sender:   { select: { id: true, name: true, email: true, image: true } },
      receiver: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const friends = friendships.map(f => {
    const friend = f.senderId === userId ? f.receiver : f.sender
    return { friendshipId: f.id, friend }
  })

  return NextResponse.json(friends)
}

// POST /api/chat/friends — send a friend request
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { receiverId } = await req.json()
  if (!receiverId || receiverId === session.user.id) {
    return NextResponse.json({ error: 'Invalid receiver' }, { status: 400 })
  }

  // Check for existing friendship in either direction
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { senderId: session.user.id, receiverId },
        { senderId: receiverId, receiverId: session.user.id },
      ],
    },
  })

  if (existing) {
    return NextResponse.json({ error: 'Friendship already exists' }, { status: 409 })
  }

  const friendship = await prisma.friendship.create({
    data: { senderId: session.user.id, receiverId },
    include: {
      sender: { select: { id: true, name: true, email: true, image: true } },
    },
  })

  // Notify receiver in real-time
  await pusherServer.trigger(userChannel(receiverId), EVENTS.FRIEND_REQUEST, {
    friendship,
    sender: friendship.sender,
  })

  return NextResponse.json(friendship, { status: 201 })
}

// PATCH /api/chat/friends — accept or decline
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { friendshipId, action } = await req.json() as {
    friendshipId: string
    action: 'accept' | 'decline'
  }

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
    include: {
      sender:   { select: { id: true, name: true, email: true, image: true } },
      receiver: { select: { id: true, name: true, email: true, image: true } },
    },
  })

  if (!friendship || friendship.receiverId !== session.user.id) {
    return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 })
  }

  if (action === 'decline') {
    await prisma.friendship.delete({ where: { id: friendshipId } })
    return NextResponse.json({ success: true })
  }

  // Accept — update friendship and create conversation
  const [updated, conversation] = await Promise.all([
    prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'ACCEPTED' },
    }),
    prisma.conversation.upsert({
      where: {
        user1Id_user2Id: {
          user1Id: friendship.senderId < friendship.receiverId ? friendship.senderId : friendship.receiverId,
          user2Id: friendship.senderId < friendship.receiverId ? friendship.receiverId : friendship.senderId,
        },
      },
      create: {
        user1Id: friendship.senderId < friendship.receiverId ? friendship.senderId : friendship.receiverId,
        user2Id: friendship.senderId < friendship.receiverId ? friendship.receiverId : friendship.senderId,
      },
      update: {},
    }),
  ])

  // Notify sender that request was accepted
  await pusherServer.trigger(userChannel(friendship.senderId), EVENTS.FRIEND_ACCEPTED, {
    friendship: updated,
    friend: friendship.receiver,
    conversationId: conversation.id,
  })

  return NextResponse.json({ friendship: updated, conversationId: conversation.id })
}

// DELETE /api/chat/friends — unfriend / cancel request
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { friendshipId } = await req.json()
  const friendship = await prisma.friendship.findUnique({ where: { id: friendshipId } })

  if (!friendship) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (friendship.senderId !== session.user.id && friendship.receiverId !== session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  await prisma.friendship.delete({ where: { id: friendshipId } })
  return NextResponse.json({ success: true })
}
