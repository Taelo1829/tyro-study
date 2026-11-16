import { beforeEach, expect, it, vi } from "vitest"
import { POST } from "./route"
const m = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), save: vi.fn(), hit: vi.fn() }))
vi.mock("@/lib/auth-session", () => ({ requireAuth: m.auth }))
vi.mock("@/lib/prisma", () => ({ prisma: { questionAttempt: { findFirst: m.find }, $executeRaw: m.save } }))
vi.mock("@/lib/rate-limit", () => ({ hit: m.hit, limitKey: () => "flag-limit" }))
const send = (extra = {}) => POST(new Request("http://localhost/api/quiz/flag", { method: "POST", body: JSON.stringify({ attemptId: "attempt", questionId: "q", reason: "Incorrect answer", ...extra }) }))
beforeEach(() => {
  vi.resetAllMocks()
  m.auth.mockResolvedValue({ userId: "student" })
  m.hit.mockResolvedValue(1)
  m.find.mockResolvedValue({ question: { id: "q", question: "What is cache?", topicId: "t", topic: { title: "Memory", chapter: { title: "Hardware", module: { title: "Computing" } } }, answers: [{ answer: "Stored data", isCorrect: true }] } })
})
it("requires login", async () => {
  m.auth.mockResolvedValue({ error: Response.json({}, { status: 401 }) })
  expect((await send()).status).toBe(401)
  expect(m.find).not.toHaveBeenCalled()
})
it("limits reports to questions belonging to the student's attempt", async () => {
  m.find.mockResolvedValue(null)
  expect((await send()).status).toBe(404)
  expect(m.find.mock.calls[0][0].where).toEqual({ quizAttemptId: "attempt", questionId: "q", quizAttempt: { userId: "student" } })
  expect(m.save).not.toHaveBeenCalled()
})
it("validates reasons and detail length and rate limits submissions", async () => {
  expect((await send({ reason: "invalid" })).status).toBe(400)
  expect((await send({ details: "x".repeat(1001) })).status).toBe(400)
  m.hit.mockResolvedValue(21)
  expect((await send()).status).toBe(429)
  expect(m.save).not.toHaveBeenCalled()
})
it("saves server-owned question context without revealing correct answers", async () => {
  const res = await send({ details: "Please check this answer" })
  expect(await res.json()).toEqual({ ok: true })
  expect(m.save.mock.calls[0]).toEqual(expect.arrayContaining([expect.stringContaining("Module: Computing"), expect.stringContaining("Please check this answer")]))
  expect(m.save.mock.calls[0][0].join(" ")).toContain("DO NOTHING")
})
