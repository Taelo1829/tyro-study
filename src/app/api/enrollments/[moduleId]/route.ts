import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ moduleId: string }> }

export async function DELETE(_request: Request, { params }: Params) {
  const { error, userId } = await requireAuth()
  if (error) return error

  const { moduleId } = await params

  const existing = await prisma.moduleEnrollment.findUnique({
    where: {
      userId_moduleId: { userId: userId!, moduleId },
    },
  })

  if (!existing) {
    return NextResponse.json({ error: "Not enrolled" }, { status: 404 })
  }

  await prisma.moduleEnrollment.delete({
    where: { id: existing.id },
  })

  return NextResponse.json({ success: true })
}
