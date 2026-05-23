import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  const userId = session.user.id

  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [
        { user1Id: userId },
        { user2Id: userId },
      ],
    },
    include: {
      user1: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      user2: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      messages: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        include: {
          sender: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  })

  // Unread count per conversation
  const unreadCounts = await prisma.message.groupBy({
    by: ["conversationId"],
    where: {
      conversation: {
        OR: [
          { user1Id: userId },
          { user2Id: userId },
        ],
      },
      senderId: {
        not: userId,
      },
      readAt: null,
    },
    _count: {
      id: true,
    },
  })

  const unreadMap = new Map(
    unreadCounts.map((u) => [u.conversationId, u._count.id])
  )

  return NextResponse.json(
    conversations.map((c) => ({
      id: c.id,
      other: c.user1Id === userId ? c.user2 : c.user1,
      lastMessage: c.messages[0] ?? null,
      unreadCount: unreadMap.get(c.id) ?? 0,
      updatedAt: c.updatedAt,
    }))
  )
}