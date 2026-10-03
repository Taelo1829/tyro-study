import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { superuserIds } from "@/lib/superuser"

// GET /api/admin/users?q=… - admin only. Lists users, newest first.
export async function GET(request: Request) {
  const { error, user: me } = await requireAdmin()
  if (error) return error

  const q = new URL(request.url).searchParams.get("q")?.trim()

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      lastVisitDate: true,
      streakDays: true,
      _count: { select: { enrollments: true, quizAttempts: true } },
    },
  })

  const [total, admins] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
  ])

  const supers = await superuserIds()
  const meSuper = supers.has(me!.id)

  return NextResponse.json({
    users: users.map(u => ({ ...u, isSuperuser: supers.has(u.id) })),
    total,
    admins,
    superusers: supers.size,
    me: {
      isSuperuser: meSuper,
      // Superusers manage admins; before the first superuser exists every admin can
      canManageAdmins: meSuper || supers.size === 0,
    },
  })
}
