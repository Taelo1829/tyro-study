import { beforeEach, expect, it, vi } from "vitest"
import { POST } from "./route"
const m = vi.hoisted(() => ({ auth: vi.fn(), attempt: vi.fn(), inQuiz: vi.fn(), claim: vi.fn(), save: vi.fn(), grade: vi.fn(), prior: vi.fn(), question: vi.fn() }))
vi.mock("@/lib/auth-session", () => ({ requireAuth: m.auth }))
vi.mock("@/lib/prisma", () => ({ prisma: { quizAttempt: { findFirst: m.attempt }, questionAttempt: { findUnique: m.inQuiz, updateMany: m.claim }, $executeRaw: m.save } }))
vi.mock("@/lib/written-quizzes", () => ({ writtenQuestion: m.question, writtenResults: m.prior }))
vi.mock("@/lib/written-grading", async (original: <T>() => Promise<T>) => ({ ...await original<typeof import("@/lib/written-grading")>(), markWrittenSubmission: m.grade }))
vi.mock("@/lib/monitoring", () => ({ captureError: vi.fn() }))
const image = "data:image/jpeg;base64," + Buffer.from([255,216,...new Array(20).fill(0)]).toString("base64")
const req = () => new Request("http://localhost/api/quiz/written", { method: "POST", body: JSON.stringify({ attemptId: "a", questionId: "q", pages: [{ image, label: "page" }] }) })
beforeEach(() => {
 vi.resetAllMocks()
 m.auth.mockResolvedValue({ userId: "student", error: null })
 m.attempt.mockResolvedValue({ id: "a", status: "IN_PROGRESS", startedAt: new Date(), settings: "{}" })
 m.inQuiz.mockResolvedValue({ status: "PENDING" })
 m.prior.mockResolvedValue(new Map())
 m.question.mockResolvedValue({ id: "q", question: "Solve", maxMarks: 5, rubric: [{ criterion: "Method", marks: 5 }], modelAnswer: "solution" })
 m.claim.mockResolvedValue({ count: 1 })
 m.save.mockResolvedValue(1)
 m.grade.mockResolvedValue({ earnedMarks: 3, maxMarks: 5 })
})
it("scopes marking to the signed-in student's attempt", async () => {
 m.attempt.mockResolvedValue(null)
 expect((await POST(req())).status).toBe(404)
 expect(m.attempt.mock.calls[0][0].where).toEqual({ id: "a", userId: "student" })
 expect(m.grade).not.toHaveBeenCalled()
})
it("rejects a question outside the attempt", async () => {
 m.inQuiz.mockResolvedValue(null)
 expect((await POST(req())).status).toBe(404)
 expect(m.grade).not.toHaveBeenCalled()
})
it("saves partial marks once and returns prior marks for retries", async () => {
 expect((await POST(req())).status).toBe(200)
 expect(m.save).toHaveBeenCalledTimes(1)
 m.prior.mockResolvedValue(new Map([["q", { earnedMarks: 3, maxMarks: 5 }]]))
 expect((await POST(req())).status).toBe(200)
 expect(m.grade).toHaveBeenCalledTimes(1)
})
it("releases a failed marking claim for retry", async () => {
 m.grade.mockRejectedValue(new Error("Unavailable"))
 expect((await POST(req())).status).toBe(503)
 expect(m.save).not.toHaveBeenCalled()
 expect(m.claim).toHaveBeenLastCalledWith(expect.objectContaining({
  data: expect.objectContaining({ status: "PENDING" }),
 }))
})
it("does not grade a completed or concurrently marking answer", async () => {
 m.attempt.mockResolvedValue({ id: "a", status: "COMPLETED", startedAt: new Date(), settings: "{}" })
 expect((await POST(req())).status).toBe(409)
 expect(m.grade).not.toHaveBeenCalled()
})
