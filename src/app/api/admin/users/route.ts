import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { superuserIds } from "@/lib/superuser"
import type { Prisma } from "@/prisma/client"

// Sorting happens before the result limit, including when searching.
export async function GET(request: Request) {
  const { error, user: me } = await requireAdmin()
  if (error) return error

  const params = new URL(request.url).searchParams
  const q = params.get("q")?.trim()
  const direction = params.get("direction") === "asc" ? "asc" : "desc"
  let orderBy: Prisma.UserOrderByWithRelationInput[]
  switch (params.get("sort")) {
    case "name":
      orderBy = [{ name: { sort: direction, nulls: "last" } }, { email: "asc" }, { id: "asc" }]
      break
    case "lastVisitDate":
      orderBy = [{ lastVisitDate: { sort: direction, nulls: "last" } }, { id: "asc" }]
      break
    default:
      orderBy = [{ createdAt: direction }, { id: "asc" }]
  }

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy,
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
