import { describe, expect, it, vi } from "vitest"
import type { Prisma } from "@/prisma/client"
import { saveAssessmentPools } from "./module-assessments"
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
function transaction(config: unknown = null) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ assessmentConfig: config ? JSON.stringify(config) : null }]),
    $executeRaw: vi.fn(),
    question: { findMany: vi.fn().mockResolvedValue([{ id: "old-question" }]), createMany: vi.fn() },
    answer: { createMany: vi.fn() },
    chapter: { findMany: vi.fn().mockResolvedValue([{ id: "chapter", topics: [{ id: "topic" }] }]) },
  }
}
const lesson = { topicId: "topic", html: "<p>Lesson</p>", version: "version", questions: [{ question: "New question", options: ["Yes", "No"], correctOption: "Yes", difficulty: "medium" as const }] }
describe("saving recreated assessments", () => {
  it("creates new topic questions, preserves old records, and disables an unverified mock", async () => {
    const tx = transaction({ topicPools: {}, chapterPools: {}, mock: { version: "old" }, mockReason: "" })
    await saveAssessmentPools(tx as unknown as Prisma.TransactionClient, "module", [lesson], { exam: null, reason: "No exam supplied" })
    expect(tx.question.createMany).toHaveBeenCalledTimes(1)
    expect(tx.question.createMany.mock.calls[0][0].data[0]).toMatchObject({ topicId: "topic", question: "New question" })
    const config = JSON.parse(tx.$executeRaw.mock.calls.at(-1)![1])
    expect(config.mock).toBeNull()
    expect(config.mockReason).toBe("No exam supplied")
    expect(config.retiredQuestionIds).toContain("old-question")
    expect(config.chapterPools).toEqual({})
    expect(tx.question.findMany).toHaveBeenCalledWith({ where: { topicId: { in: ["topic"] } }, select: { id: true } })
  })
  it("does not duplicate questions on a repeated save", async () => {
    const first = transaction()
    const decision = { exam: null, reason: "No exam supplied" }
    await saveAssessmentPools(first as unknown as Prisma.TransactionClient, "module", [lesson], decision)
    const next = transaction(JSON.parse(first.$executeRaw.mock.calls.at(-1)![1]))
    await saveAssessmentPools(next as unknown as Prisma.TransactionClient, "module", [lesson], decision)
    expect(next.question.createMany).not.toHaveBeenCalled()
  })
})
