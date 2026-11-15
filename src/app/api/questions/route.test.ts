import { beforeEach, expect, it, vi } from "vitest"
import { POST } from "./route"
const m = vi.hoisted(() => ({ check: vi.fn(), create: vi.fn(), transaction: vi.fn() }))
vi.mock("@/lib/admin", () => ({ requireAdmin: async () => ({}) }))
vi.mock("@/lib/question-duplicates", () => ({ checkQuestionAdditions: m.check }))
vi.mock("@/lib/prisma", () => ({ prisma: { topic: { findUnique: async () => ({ id: "topic" }) }, question: { create: m.create }, $transaction: m.transaction } }))
const question = { question: "What executes instructions?", options: ["CPU", "RAM"], correctOption: "CPU" }
const request = () => new Request("http://localhost/api/questions", { method: "POST", body: JSON.stringify({ topicId: "topic", questions: [question] }) })
beforeEach(() => {
  vi.resetAllMocks()
  m.check.mockResolvedValue(new Map())
  m.transaction.mockResolvedValue([{ id: "new" }])
})
it("blocks the save and identifies the duplicate for review", async () => {
  m.check.mockResolvedValue(new Map([[0, question]]))
  const response = await POST(request())
  expect(response.status).toBe(409)
  expect((await response.json()).duplicates).toEqual([{ index: 0, question: question.question }])
  expect(m.create).not.toHaveBeenCalled()
})
it("does not save unchecked questions when semantic detection is unavailable", async () => {
  m.check.mockRejectedValue(new Error("Unavailable"))
  expect((await POST(request())).status).toBe(503)
  expect(m.create).not.toHaveBeenCalled()
})
it("saves unique questions after checking the target pool", async () => {
  expect((await POST(request())).status).toBe(201)
  expect(m.check).toHaveBeenCalledWith({ topicId: "topic", chapterId: undefined }, [question])
  expect(m.create).toHaveBeenCalledOnce()
})
