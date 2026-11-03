import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getOnboardingState } from "@/lib/onboarding"
import { getUserLevel } from "@/lib/levels-server"
import { termsFor } from "@/lib/levels"
import { todayInSA } from "@/lib/onboarding-input"
import { OnboardingForm } from "@/components/onboarding/onboarding-form"

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login?callbackUrl=/onboarding")
  const userId = session.user.id
  const state = await getOnboardingState(userId)
  if (state.onboardingStep === 3 || session.user.role === "ADMIN") redirect("/dashboard")
  const level = await getUserLevel(userId)
  const [modules, enrollments, deadline] = await Promise.all([
    prisma.$queryRaw<{ id: string; title: string; description: string | null }[]>`
      SELECT "id", "title", "description" FROM "modules" WHERE "level" = ${level} ORDER BY "title" ASC`,
    prisma.moduleEnrollment.findMany({ where: { userId }, select: { moduleId: true } }),
    prisma.calendarEvent.findUnique({ where: { id: `onboarding:${userId}` } }),
  ])
  return (
    <main className="min-h-dvh bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <p className="mb-8 text-lg font-bold">Tyro Study</p>
        <OnboardingForm
          initialStep={state.onboardingStep}
          modules={modules}
          moduleLabel={termsFor(level).module}
          modulesLabel={termsFor(level).modules}
          initialSelected={enrollments.map(e => e.moduleId)}
          initialDeadline={deadline?.moduleId ? { moduleId: deadline.moduleId, type: deadline.type === "ASSIGNMENT" ? "ASSIGNMENT" : "EXAM", date: todayInSA(deadline.startAt) } : null}
          today={todayInSA()}
        />
      </div>
    </main>
  )
}
