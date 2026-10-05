import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

/** GET (admins) → a student and the modules they've joined, for their progress page */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error
  const user = await prisma.user.findUnique({
    where: { id: (await params).id },
    select: {
      id: true,
      name: true,
      email: true,
      enrollments: { select: { module: { select: { id: true, title: true } } }, orderBy: { enrolledAt: "asc" } },
    },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  return NextResponse.json({ id: user.id, name: user.name, email: user.email, modules: user.enrollments.map(e => e.module) })
}
