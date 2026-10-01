import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ id: string }> }

async function isLastAdmin(userId: string) {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (target?.role !== "ADMIN") return false
  return (await prisma.user.count({ where: { role: "ADMIN" } })) <= 1
}

// PATCH /api/admin/users/:id { role: "STUDENT" | "ADMIN" } — admin only.
export async function PATCH(request: Request, { params }: Params) {
  const { error, user: me } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const { role } = (await request.json().catch(() => ({}))) as { role?: string }

  if (role !== "STUDENT" && role !== "ADMIN") {
    return NextResponse.json({ error: "role must be STUDENT or ADMIN" }, { status: 400 })
  }
  if (!(await prisma.user.findUnique({ where: { id }, select: { id: true } }))) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }
  if (role === "STUDENT") {
    if (id === me!.id) {
      return NextResponse.json({ error: "You can't remove your own admin access" }, { status: 400 })
    }
    if (await isLastAdmin(id)) {
      return NextResponse.json({ error: "There must be at least one admin" }, { status: 400 })
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, role: true },
  })
  return NextResponse.json(updated)
}

// DELETE /api/admin/users/:id — admin only. Permanently deletes the account
// and everything linked to it (enrollments, quiz history, chats, timetable…).
export async function DELETE(_request: Request, { params }: Params) {
  const { error, user: me } = await requireAdmin()
  if (error) return error

  const { id } = await params
  if (id === me!.id) {
    return NextResponse.json({ error: "You can't delete your own account here" }, { status: 400 })
  }
  if (!(await prisma.user.findUnique({ where: { id }, select: { id: true } }))) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }
  if (await isLastAdmin(id)) {
    return NextResponse.json({ error: "There must be at least one admin" }, { status: 400 })
  }

  // These two tables aren't linked to users in the schema, so clear them by hand
  await prisma.$transaction([
    prisma.pushSubscription.deleteMany({ where: { userId: id } }),
    prisma.assignment_Attempt.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ])

  return NextResponse.json({ success: true })
}
