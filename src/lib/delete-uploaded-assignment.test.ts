import { beforeEach, expect, it, vi } from "vitest"
import { deleteUploadedAssignment } from "./delete-uploaded-assignment"
const m = vi.hoisted(() => ({ transaction: vi.fn(), module: vi.fn(), topic: vi.fn(), deleteTopic: vi.fn(), quizzes: vi.fn(), assignments: vi.fn(), execute: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: m.transaction } }))
const id = "assignment-" + "a".repeat(40)
beforeEach(() => {
 vi.resetAllMocks()
 m.module.mockResolvedValue([{ id: "module", assessmentConfig: null }])
 m.topic.mockResolvedValue({ id, questions: [{ id: "q1" }, { id: "old-q" }] })
 m.transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({ $queryRaw: m.module, $executeRaw: m.execute, topic: { findFirst: m.topic, delete: m.deleteTopic }, quizAttempt: { deleteMany: m.quizzes }, assignment_Attempt: { deleteMany: m.assignments } }))
})
it("refuses ordinary topics before starting a transaction", async () => {
 expect(await deleteUploadedAssignment("module", "ordinary-topic")).toBe(false)
 expect(m.transaction).not.toHaveBeenCalled()
})
it("refuses an assignment outside the selected module", async () => {
 m.topic.mockResolvedValue(null)
 expect(await deleteUploadedAssignment("module", id)).toBe(false)
 expect(m.topic.mock.calls[0][0].where).toEqual({ id, chapter: { moduleId: "module" } })
 expect(m.deleteTopic).not.toHaveBeenCalled()
 expect(m.quizzes).not.toHaveBeenCalled()
})
it("removes assignment attempts before deleting the topic and its cascading content", async () => {
 expect(await deleteUploadedAssignment("module", id)).toBe(true)
 expect(m.quizzes).toHaveBeenCalledWith({ where: { topicId: id } })
 expect(m.assignments).toHaveBeenCalledWith({ where: { topicId: id } })
 expect(m.deleteTopic).toHaveBeenCalledWith({ where: { id } })
 expect(m.quizzes.mock.invocationCallOrder[0]).toBeLessThan(m.deleteTopic.mock.invocationCallOrder[0])
})
it("cleans obsolete quiz references while preserving other module content", async () => {
 m.module.mockResolvedValue([{ id: "module", assessmentConfig: JSON.stringify({ topicPools: { [id]: ["q1"], other: ["keep"] }, chapterPools: { ch: ["q1", "keep"] }, retiredQuestionIds: ["old-q", "keep-retired"], mock: null, mockReason: "Existing reason", batchHash: "old" }) }])
 await deleteUploadedAssignment("module", id)
 const config = JSON.parse(m.execute.mock.calls[0][1])
 expect(config.topicPools).toEqual({ other: ["keep"] })
 expect(config.chapterPools).toEqual({ ch: ["keep"] })
 expect(config.retiredQuestionIds).toEqual(["keep-retired"])
 expect(config.mockReason).toBe("Existing reason")
 expect(config.batchHash).toBeUndefined()
})
it("propagates a failure so the whole transaction rolls back", async () => {
 m.assignments.mockRejectedValue(new Error("database error"))
 await expect(deleteUploadedAssignment("module", id)).rejects.toThrow("database error")
 expect(m.deleteTopic).not.toHaveBeenCalled()
})
