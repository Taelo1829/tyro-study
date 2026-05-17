import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { recordDailyVisit } from "@/lib/streak"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/login")
  }

  let isAdmin = false
  try {
    const user = await recordDailyVisit(session.user.id)
    isAdmin = user?.role === "ADMIN"
  } catch {
    // DB may be unavailable during local setup
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex min-h-dvh max-w-7xl gap-4 p-4 pb-24 lg:pb-4">
        <Sidebar isAdmin={isAdmin} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <MobileNav isAdmin={isAdmin} />
    </div>
  )
}
