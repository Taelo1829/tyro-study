import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "./route"
const mocks = vi.hoisted(() => ({ config: vi.fn(), questions: vi.fn(), create: vi.fn(), createMany: vi.fn(), raw: vi.fn() }))
vi.mock("next-auth", () => ({ getServerSession: async () => ({ user: { id: "student", email: "student@example.test" } }) }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: async () => ({ id: "student", role: "STUDENT" }) }, topic: { findUnique: async () => ({ chapter: { moduleId: "module" } }) }, question: { findMany: mocks.questions }, quizAttempt: { create: mocks.create }, questionAttempt: { createMany: mocks.createMany }, $queryRaw: mocks.raw } }))
vi.mock("@/lib/module-assessments", async (importOriginal: <T>() => Promise<T>) => ({ ...await importOriginal<typeof import("@/lib/module-assessments")>(), getModuleAssessments: mocks.config }))
vi.mock("@/lib/question-kinds", () => ({ blankQuestionIds: async () => new Set(), saveTypedAnswer: vi.fn(), typedAnswers: vi.fn() }))
vi.mock("@/lib/topic-locks", () => ({ getTopicLock: async () => null, lockedResponseBody: vi.fn() }))
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }))
vi.mock("@/lib/monitoring", () => ({ captureError: vi.fn() }))
const request = (extra = {}) => new NextRequest("http://localhost/api/quiz/attempt", { method: "POST", body: JSON.stringify({ moduleId: "module", fresh: true, ...extra }) })
const exam = { version: "v1", sourceName: "exam.pdf", durationMinutes: 120, totalQuestions: 2, totalMarks: 4, instructions: "Answer all questions.", sections: [{ title: "Section A", instructions: "", questions: [{ id: "q1", label: "1", marks: 2, optionIds: ["a1", "a2"] }, { id: "q2", label: "2", marks: 2, optionIds: ["b1", "b2"] }] }] }
const question = (id: string, options: string[]) => ({ id, question: id, topic: null, topicId: null, chapterId: null, difficulty: "medium", answers: options.map((id, i) => ({ id, answer: id, isCorrect: i === 0 })) })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.config.mockResolvedValue({ topicPools: {}, chapterPools: {}, mock: exam })
  mocks.questions.mockResolvedValue([question("q2", ["b2", "b1"]), question("q1", ["a2", "a1"])])
  mocks.create.mockResolvedValue({ id: "attempt", startedAt: new Date() })
  mocks.raw.mockResolvedValue([])
})
describe("strict mock exam starts", () => {
  it("does not create an exam without a reviewed template", async () => {
    mocks.config.mockResolvedValue(null)
    expect((await POST(request())).status).toBe(409)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it("does not substitute questions when the template is incomplete", async () => {
    mocks.questions.mockResolvedValue([question("q1", ["a1", "a2"])])
    expect((await POST(request())).status).toBe(409)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it("enforces source question and option order, count and time despite client settings", async () => {
    const response = await POST(request({ settings: { questionsPerQuiz: 1, timeLimit: 1, randomizeQuestions: true, randomizeOptions: true } }))
    expect(response.status).toBe(200)
    const { data } = await response.json()
    expect(data.questions.map((q: { id: string }) => q.id)).toEqual(["q1", "q2"])
    expect(data.questions[0].options.map((o: { id: string }) => o.id)).toEqual(["a1", "a2"])
    expect(data.settings).toMatchObject({ questionsPerQuiz: 2, timeLimit: 120, randomizeQuestions: false, randomizeOptions: false, mockExam: true })
    expect(data.questions[0].exam).toMatchObject({ section: "Section A", label: "1", marks: 2 })
  })
  it("rejects a custom question list disguised as a module exam", async () => {
    expect((await POST(request({ questionIds: ["q1"] }))).status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })
})

it("keeps every uploaded assignment question and source order despite quiz size settings", async () => {
 const topic = { id: "topic", title: "Assignment quiz: Assignment 1", chapter: { title: "Chapter", moduleId: "module", module: { title: "Module" } } }
 const pool = Array.from({ length: 25 }, (_, i) => ({ ...question(`q${i}`, [`q${i}-1`, `q${i}-0`]), topic, createdAt: new Date(1000 + i) })).reverse()
 mocks.questions.mockResolvedValue(pool)
 const response = await POST(request({ moduleId: undefined, topicId: "topic", settings: { questionsPerQuiz: 1, randomizeQuestions: true, randomizeOptions: true } }))
 expect(response.status).toBe(200)
 const { data } = await response.json()
 expect(data.questions).toHaveLength(25)
 expect(data.questions.map((q: { id: string }) => q.id)).toEqual(Array.from({ length: 25 }, (_, i) => `q${i}`))
 expect(data.questions[0].options.map((o: { id: string }) => o.id)).toEqual(["q0-0", "q0-1"])
 expect(data.settings).toMatchObject({ randomizeQuestions: false, randomizeOptions: false, questionsPerQuiz: 25 })
})
