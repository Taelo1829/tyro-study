import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { redirect } from "next/navigation"
import { authOptions } from "./auth"
import { prisma } from "./prisma"

export async function requireAdmin() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, email: true },
  })

  if (!user || user.role !== "ADMIN") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
    }
  }

  return { error: null, session, user }
}

/**
 * Guard for admin PAGES (server components). Call it first in every admin
 * page that loads data:
 *
 *   export default async function Page() { await requireAdminPage(); … }
 *
 * The admin layout's check is not enough: Next.js renders a layout and its
 * page in parallel, so a page's data can be sent even when the layout
 * redirects (found in business/12 §3). The proxy also refuses /admin for
 * non-admin tokens; this re-checks the role in the database, so a demoted
 * admin with an old session is refused too.
 */
export async function requireAdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (user?.role !== "ADMIN") redirect("/dashboard")
  return session
}
