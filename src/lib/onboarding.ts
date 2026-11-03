import { prisma } from "@/lib/prisma"
import type { OnboardingInput } from "@/lib/onboarding-input"

export interface OnboardingState { onboardingStep: number; dailyGoal: number | null }
export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const [state] = await prisma.$queryRaw<OnboardingState[]>`
    SELECT "onboardingStep", "dailyGoal" FROM "users" WHERE "id" = ${userId}`
  if (!state) throw new Error("Account not found")
  return state
}

export class OnboardingError extends Error {}

/** Each step commits with its data. A retry cannot duplicate a deadline or enrollment. */
export async function saveOnboardingStep(userId: string, input: OnboardingInput) {
  return prisma.$transaction(async tx => {
    const [user] = await tx.$queryRaw<{ onboardingStep: number; level: string }[]>`
      SELECT "onboardingStep", "level" FROM "users" WHERE "id" = ${userId} FOR UPDATE`
    if (!user) throw new OnboardingError("Account not found.")
    if (user.onboardingStep === 3) return 3
    if (input.step > user.onboardingStep) throw new OnboardingError("Complete the previous step first.")
    const eventId = `onboarding:${userId}`
    if (input.step === 0) {
      const available = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "modules" WHERE "level" = ${user.level}`
      const allowed = new Set(available.map(m => m.id))
      if (input.moduleIds.some(id => !allowed.has(id))) throw new OnboardingError("Choose modules for your study level.")
      if (available.length && !input.moduleIds.length) throw new OnboardingError("Choose at least one module.")
      await tx.moduleEnrollment.deleteMany({ where: { userId, moduleId: { notIn: input.moduleIds } } })
      await tx.moduleEnrollment.createMany({ data: input.moduleIds.map(moduleId => ({ userId, moduleId })), skipDuplicates: true })
      // Going back to change modules resets the onboarding deadline.
      await tx.calendarEvent.deleteMany({ where: { id: eventId, userId } })
    } else if (input.step === 1) {
      if (input.deadline) {
        const d = input.deadline
        const enrollment = await tx.moduleEnrollment.findUnique({
          where: { userId_moduleId: { userId, moduleId: d.moduleId } },
          select: { module: { select: { title: true } } },
        })
        if (!enrollment) throw new OnboardingError("Choose one of your selected modules.")
        const event = { moduleId: d.moduleId, type: d.type, title: `${enrollment.module.title} ${d.type === "EXAM" ? "exam" : "assignment"}`, startAt: new Date(`${d.date}T00:00:00+02:00`), allDay: true }
        await tx.calendarEvent.upsert({ where: { id: eventId }, create: { id: eventId, userId, ...event }, update: event })
      } else {
        await tx.calendarEvent.deleteMany({ where: { id: eventId, userId } })
      }
    } else {
      await tx.$executeRaw`UPDATE "users" SET "dailyGoal" = ${input.dailyGoal} WHERE "id" = ${userId}`
    }
    const next = input.step + 1
    await tx.$executeRaw`UPDATE "users" SET "onboardingStep" = ${next} WHERE "id" = ${userId}`
    return next
  })
}
