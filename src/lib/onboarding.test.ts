import { beforeEach, describe, expect, it, vi } from "vitest"
import { saveOnboardingStep } from "./onboarding"
const mocks = vi.hoisted(() => {
  const tx = { $queryRaw: vi.fn(), $executeRaw: vi.fn(), moduleEnrollment: { deleteMany: vi.fn(), createMany: vi.fn(), findUnique: vi.fn() }, calendarEvent: { deleteMany: vi.fn(), upsert: vi.fn() } }
  return { tx }
})
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx) } }))
beforeEach(() => vi.resetAllMocks())

describe("saving onboarding", () => {
  it("leaves completed accounts unchanged on duplicate submissions", async () => {
    mocks.tx.$queryRaw.mockResolvedValueOnce([{ onboardingStep: 3, level: "tertiary" }])
    expect(await saveOnboardingStep("student", { step: 2, dailyGoal: 10 })).toBe(3)
    expect(mocks.tx.$executeRaw).not.toHaveBeenCalled()
  })
  it("does not allow skipping the module and date steps", async () => {
    mocks.tx.$queryRaw.mockResolvedValueOnce([{ onboardingStep: 0, level: "tertiary" }])
    await expect(saveOnboardingStep("student", { step: 2, dailyGoal: 10 })).rejects.toThrow("previous step")
    expect(mocks.tx.$executeRaw).not.toHaveBeenCalled()
  })
  it("rejects modules outside the student's level before changing enrollments", async () => {
    mocks.tx.$queryRaw.mockResolvedValueOnce([{ onboardingStep: 0, level: "tertiary" }]).mockResolvedValueOnce([{ id: "allowed" }])
    await expect(saveOnboardingStep("student", { step: 0, moduleIds: ["other-level"] })).rejects.toThrow("study level")
    expect(mocks.tx.moduleEnrollment.deleteMany).not.toHaveBeenCalled()
  })
  it("requires a choice when modules are available", async () => {
    mocks.tx.$queryRaw.mockResolvedValueOnce([{ onboardingStep: 0, level: "tertiary" }]).mockResolvedValueOnce([{ id: "a" }])
    await expect(saveOnboardingStep("student", { step: 0, moduleIds: [] })).rejects.toThrow("at least one")
  })
  it("uses the student's enrollment to validate a deadline", async () => {
    mocks.tx.$queryRaw.mockResolvedValueOnce([{ onboardingStep: 1, level: "tertiary" }])
    mocks.tx.moduleEnrollment.findUnique.mockResolvedValue(null)
    await expect(saveOnboardingStep("student", { step: 1, deadline: { moduleId: "unjoined", type: "EXAM", date: "2027-01-15" } })).rejects.toThrow("selected modules")
    expect(mocks.tx.calendarEvent.upsert).not.toHaveBeenCalled()
  })
  it("upserts one all-day event at South African midnight", async () => {
    mocks.tx.$queryRaw.mockResolvedValueOnce([{ onboardingStep: 1, level: "tertiary" }])
    mocks.tx.moduleEnrollment.findUnique.mockResolvedValue({ module: { title: "Maths" } })
    expect(await saveOnboardingStep("student", { step: 1, deadline: { moduleId: "maths", type: "EXAM", date: "2027-01-15" } })).toBe(2)
    expect(mocks.tx.calendarEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "onboarding:student" }, create: expect.objectContaining({ userId: "student", allDay: true, startAt: new Date("2027-01-14T22:00:00Z") }) }))
  })
  it("lets students continue when their catalogue is empty", async () => {
    mocks.tx.$queryRaw.mockResolvedValueOnce([{ onboardingStep: 0, level: "tertiary" }]).mockResolvedValueOnce([])
    expect(await saveOnboardingStep("student", { step: 0, moduleIds: [] })).toBe(1)
  })
})
