import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { SUPERUSER_ONLY, canManageAdmins, isSuperuser, setSuperuser, superuserCount } from "@/lib/superuser"

type Params = { params: Promise<{ id: string }> }

async function isLastAdmin(userId: string) {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (target?.role !== "ADMIN") return false
  return (await prisma.user.count({ where: { role: "ADMIN" } })) <= 1
}

/** Removing this user's superuser would leave nobody able to manage admins */
async function isLastSuperuser(userId: string) {
  return (await isSuperuser(userId)) && (await superuserCount()) <= 1
}

// PATCH /api/admin/users/:id { role?: "STUDENT" | "ADMIN", isSuperuser?: boolean }
// Changing roles needs a superuser (or any admin before the first superuser
// exists). Granting/removing superuser always needs a superuser.
export async function PATCH(request: Request, { params }: Params) {
  const { error, user: me } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as { role?: string; isSuperuser?: unknown }
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } })
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })

  if (typeof body.isSuperuser === "boolean") {
    if (!(await isSuperuser(me!.id))) return NextResponse.json({ error: SUPERUSER_ONLY }, { status: 403 })
    if (body.isSuperuser && target.role !== "ADMIN") {
      return NextResponse.json({ error: "Make them an admin first" }, { status: 400 })
    }
    if (!body.isSuperuser && (await isLastSuperuser(id))) {
      return NextResponse.json({ error: "There must be at least one superuser" }, { status: 400 })
    }
    await setSuperuser(id, body.isSuperuser)
    return NextResponse.json({ id, isSuperuser: body.isSuperuser })
  }

  const role = body.role
  if (role !== "STUDENT" && role !== "ADMIN") {
    return NextResponse.json({ error: "role must be STUDENT or ADMIN" }, { status: 400 })
  }
  if (!(await canManageAdmins(me!.id))) {
    return NextResponse.json({ error: SUPERUSER_ONLY }, { status: 403 })
  }
  if (role === "STUDENT") {
    if (id === me!.id) {
      return NextResponse.json({ error: "You can't remove your own admin access" }, { status: 400 })
    }
    if (await isLastAdmin(id)) {
      return NextResponse.json({ error: "There must be at least one admin" }, { status: 400 })
    }
    if (await isLastSuperuser(id)) {
      return NextResponse.json({ error: "There must be at least one superuser" }, { status: 400 })
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, role: true },
  })
  // Students can't be superusers
  if (role === "STUDENT") await setSuperuser(id, false)
  return NextResponse.json(updated)
}

// DELETE /api/admin/users/:id - admin only (deleting an admin needs a
// superuser). Permanently deletes the account and everything linked to it
// (enrollments, quiz history, chats, timetable…).
export async function DELETE(_request: Request, { params }: Params) {
  const { error, user: me } = await requireAdmin()
  if (error) return error

  const { id } = await params
  if (id === me!.id) {
    return NextResponse.json({ error: "You can't delete your own account here" }, { status: 400 })
  }
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } })
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (target.role === "ADMIN" && !(await canManageAdmins(me!.id))) {
    return NextResponse.json({ error: SUPERUSER_ONLY }, { status: 403 })
  }
  if (await isLastAdmin(id)) {
    return NextResponse.json({ error: "There must be at least one admin" }, { status: 400 })
  }
  if (await isLastSuperuser(id)) {
    return NextResponse.json({ error: "There must be at least one superuser" }, { status: 400 })
  }

  // These two tables aren't linked to users in the schema, so clear them by hand
  await prisma.$transaction([
    prisma.pushSubscription.deleteMany({ where: { userId: id } }),
    prisma.assignment_Attempt.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ])

  return NextResponse.json({ success: true })
}
