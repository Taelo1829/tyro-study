import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { recordDailyVisit } from "@/lib/streak"
import { TopNav } from "@/components/layout/top-nav"
import { MobileNav } from "@/components/layout/mobile-nav"
import { PresenceProvider } from "@/components/providers/presence-provider"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/login")
  }

  const isAdmin = session.user.role === "ADMIN"

  // Count today's visit on any page of the app (not only the dashboard), so
  // studying straight from a module, quiz or chat link keeps the streak going.
  // A failure here must never block the page.
  await recordDailyVisit(session.user.id).catch(error =>
    console.error("Streak update failed:", error)
  )

  return (
    <PresenceProvider>
      <div className="min-h-dvh bg-background">
        <TopNav isAdmin={isAdmin} />
        {/* pt clears the fixed top nav; pb clears the mobile bottom bar */}
        <main className="mx-auto min-h-dvh max-w-7xl px-4 pb-28 pt-24 sm:px-6 sm:pt-28 lg:pb-10">
          {children}
        </main>
        <MobileNav isAdmin={isAdmin} />
      </div>
    </PresenceProvider>
  )
}
