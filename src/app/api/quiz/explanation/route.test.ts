import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "./route"

const mocks = vi.hoisted(() => ({ session: vi.fn(), find: vi.fn(), notes: vi.fn() }))
vi.mock("next-auth", () => ({ getServerSession: mocks.session }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/prisma", () => ({ prisma: { questionAttempt: { findFirst: mocks.find } } }))
vi.mock("@/lib/ai/question-notes", () => ({ notesForQuestions: mocks.notes }))
vi.mock("@/lib/monitoring", () => ({ captureError: vi.fn() }))
const request = (body: unknown = { attemptId: "attempt", questionId: "question" }) => new Request("http://localhost/api/quiz/explanation", { method: "POST", body: JSON.stringify(body) })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue({ user: { id: "student" } })
  mocks.find.mockResolvedValue({ questionId: "question", isCorrect: false })
  mocks.notes.mockResolvedValue([{ html: "<p>The reasoning.</p>" }])
})

describe("answer explanations", () => {
  it("rejects unauthenticated requests before looking up answers", async () => {
    mocks.session.mockResolvedValue(null)
    expect((await POST(request())).status).toBe(401)
    expect(mocks.find).not.toHaveBeenCalled()
  })
  it("validates the request", async () => {
    expect((await POST(request(null))).status).toBe(400)
    expect((await POST(request({ attemptId: "attempt" }))).status).toBe(400)
    expect(mocks.notes).not.toHaveBeenCalled()
  })
  it("requires an incorrect marked answer owned by the current student", async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ html: "<p>The reasoning.</p>" })
    expect(mocks.find).toHaveBeenCalledWith({
      where: { quizAttemptId: "attempt", questionId: "question", status: "ANSWERED", isCorrect: false, quizAttempt: { userId: "student" } },
      select: { questionId: true, isCorrect: true },
    })
    expect(mocks.notes).toHaveBeenCalledWith(["question"], { appendToLesson: false })
  })
  it("does not generate or reveal explanations for inaccessible or unmarked answers", async () => {
    mocks.find.mockResolvedValue(null)
    expect((await POST(request())).status).toBe(404)
    expect(mocks.notes).not.toHaveBeenCalled()
  })
  it("does not call the explanation generator for a correct answer", async () => {
    mocks.find.mockResolvedValue({ questionId: "question", isCorrect: true })
    expect((await POST(request())).status).toBe(404)
    expect(mocks.notes).not.toHaveBeenCalled()
  })
  it("returns a retryable response when drafting is unavailable", async () => {
    mocks.notes.mockResolvedValue([])
    expect((await POST(request())).status).toBe(503)
  })
})
