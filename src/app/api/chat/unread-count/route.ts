import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const unreadConversations = await prisma.message.groupBy({
    by: ["conversationId"],
    where: {
      conversation: {
        OR: [{ user1Id: session.user.id }, { user2Id: session.user.id }],
      },
      senderId: { not: session.user.id },
      readAt: null,
    },
  })

  return NextResponse.json({ count: unreadConversations.length })
}
