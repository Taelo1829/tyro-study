import { beforeEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { PUT } from "./route"
const m = vi.hoisted(() => ({ attempt: vi.fn(), results: vi.fn(), all: vi.fn(), update: vi.fn(), save: vi.fn() }))
vi.mock("next-auth", () => ({ getServerSession: async () => ({ user: { id: "s", email: "s@example.test" } }) }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: async () => ({ id: "s" }) }, quizAttempt: { findFirst: m.attempt, update: m.update }, questionAttempt: { findMany: m.all, updateMany: vi.fn() }, answer: { findMany: async () => [] } } }))
vi.mock("@/lib/written-quizzes", async (original: <T>() => Promise<T>) => ({ ...await original<typeof import("@/lib/written-quizzes")>(), questionFormats: async () => new Map([["w", { id: "w", kind: "written", maxMarks: 5 }]]), writtenResults: m.results }))
vi.mock("@/lib/question-kinds", () => ({ blankQuestionIds: async () => new Set(), typedAnswers: async () => new Map(), saveTypedAnswer: vi.fn() }))
vi.mock("@/lib/quiz-finish", () => ({ saveFinalAnswers: m.save }))
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }))
vi.mock("@/lib/monitoring", () => ({ captureError: vi.fn() }))
vi.mock("@/lib/log", () => ({ log: { info: vi.fn(), warn: vi.fn() }, requestIdFrom: vi.fn() }))
const req = (extra = {}) => new NextRequest("http://localhost/api/quiz/attempt", { method: "PUT", body: JSON.stringify({ attemptId: "a", questionId: "w", writtenAnswer: true, ...extra }) })
beforeEach(() => {
 vi.resetAllMocks()
 m.attempt.mockResolvedValue({ id: "a", startedAt: new Date(), totalQuestions: 1, questionsData: JSON.stringify([{ id: "w", maxMarks: 5 }]), settings: JSON.stringify({ passingScore: 70 }) })
 m.results.mockResolvedValue(new Map([["w", { earnedMarks: 3.5, maxMarks: 5, transcription: "Work" }]]))
 m.all.mockResolvedValue([{ questionId: "w", status: "ANSWERED", isCorrect: false, selectedAnswerId: null }])
})
it("finishes a written quiz using stored partial marks", async () => {
 const response = await PUT(req())
 expect(response.status).toBe(200)
 expect(await response.json()).toMatchObject({ completed: true, score: 70, passed: true, earnedMarks: 3.5, totalMarks: 5 })
 expect(m.save).toHaveBeenCalledWith("s", [{ questionId: "w", selectedAnswerId: null, isCorrect: false, typed: "Work" }])
})
it("does not trust a client claim that written work was graded", async () => {
 m.results.mockResolvedValue(new Map())
 expect((await PUT(req({ isCorrect: true, earnedMarks: 5 }))).status).toBe(400)
 expect(m.update).not.toHaveBeenCalled()
})
it("rejects trying to mark written work as multiple choice", async () => {
 expect((await PUT(req({ writtenAnswer: false, selectedAnswerId: "fake" }))).status).toBe(400)
 expect(m.update).not.toHaveBeenCalled()
})
