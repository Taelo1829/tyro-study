import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requireAuth()
  if (error) return error
  const { id } = await params
  // Record actual navigation, never a prefetched GET. Only update this user's enrollment.
  const updated = await prisma.$executeRaw`UPDATE "module_enrollments"
    SET "lastOpenedAt" = CURRENT_TIMESTAMP
    WHERE "userId" = ${userId} AND "moduleId" = ${id}`
  return NextResponse.json({ recorded: updated > 0 })
}
