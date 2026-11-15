import { beforeEach, expect, it, vi } from "vitest"
import { savePaperQuestions } from "./paper-questions"
const m = vi.hoisted(() => ({ transaction: vi.fn(), query: vi.fn(), topics: vi.fn(), questions: vi.fn(), answers: vi.fn(), execute: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: m.transaction } }))
const input = { topicId: "memory", question: "What does cache store?", options: ["Recently used data", "Only programs"], correctOption: "Recently used data", difficulty: "medium" }
beforeEach(() => {
  vi.resetAllMocks()
  m.query.mockResolvedValue([{ assessmentConfig: JSON.stringify({ topicPools: { memory: ["existing"] }, chapterPools: { chapter: ["chapter-q"] }, mock: { version: "exam" }, mockReason: "" }) }])
  m.topics.mockResolvedValue([{ id: "memory", title: "Cache Memory", questions: [] }, { id: "assignment-abc", title: "Assignment quiz: 1", questions: [] }])
  m.transaction.mockImplementation(fn => fn({ $queryRaw: m.query, $executeRaw: m.execute, topic: { findMany: m.topics }, question: { createMany: m.questions }, answer: { createMany: m.answers } }))
})
it("adds questions to their matched topics and appends to legacy active pools", async () => {
  expect(await savePaperQuestions("mod", "Exam 2025", [input])).toMatchObject({ added: 1, topics: 1, skipped: 0 })
  const created = m.questions.mock.calls[0][0].data[0]
  expect(created.topicId).toBe("memory")
  const config = JSON.parse(m.execute.mock.calls[1][1])
  expect(config.topicPools.memory).toEqual(["existing", created.id])
  expect(config.chapterPools).toEqual({ chapter: ["chapter-q"] })
  expect(config.mock).toEqual({ version: "exam" })
})
it("skips invalid, cross-module and assignment checkpoint destinations", async () => {
  const result = await savePaperQuestions("mod", "Paper", [{ ...input, topicId: "outside" }, { ...input, topicId: "assignment-abc" }, { ...input, correctOption: "Missing" }])
  expect(result).toMatchObject({ added: 0, skipped: 3, topics: 0 })
  expect(m.questions).not.toHaveBeenCalled()
})
it("deduplicates a batch and restores an existing question to the active pool on re-upload", async () => {
  m.topics.mockResolvedValue([{ id: "memory", title: "Cache", questions: [{ id: "paper-q", question: input.question, answers: input.options.map(answer => ({ answer, isCorrect: answer === input.correctOption })) }] }])
  expect(await savePaperQuestions("mod", "Paper", [input, input])).toMatchObject({ added: 0, skipped: 2, topics: 1 })
  expect(m.questions).not.toHaveBeenCalled()
  expect(JSON.parse(m.execute.mock.calls[1][1]).topicPools.memory).toEqual(["existing", "paper-q"])
})
it("does not confuse questions with different mathematical operators", async () => {
  expect(await savePaperQuestions("mod", "Paper", [{ ...input, question: "Solve x < 0" }, { ...input, question: "Solve x > 0" }])).toMatchObject({ added: 2 })
})
it("creates a new question rather than reviving retired answer history", async () => {
  m.query.mockResolvedValue([{ assessmentConfig: JSON.stringify({ topicPools: { memory: [] }, chapterPools: {}, retiredQuestionIds: ["old"], mock: null }) }])
  m.topics.mockResolvedValue([{ id: "memory", title: "Cache", questions: [{ id: "old", question: input.question, answers: input.options.map(answer => ({ answer, isCorrect: answer === input.correctOption })) }] }])
  expect(await savePaperQuestions("mod", "Paper", [input])).toMatchObject({ added: 1 })
  const config = JSON.parse(m.execute.mock.calls[1][1])
  expect(config.retiredQuestionIds).toEqual(["old"])
  expect(config.topicPools.memory).not.toContain("old")
})
it("supports modules without an explicit quiz configuration", async () => {
  m.query.mockResolvedValue([{ assessmentConfig: null }])
  expect(await savePaperQuestions("mod", "Paper", [input])).toMatchObject({ added: 1 })
  expect(m.execute).toHaveBeenCalledOnce()
})
it("propagates save failures through the transaction instead of reporting partial success", async () => {
  m.execute.mockRejectedValue(new Error("Database unavailable"))
  await expect(savePaperQuestions("mod", "Paper", [input])).rejects.toThrow("Database unavailable")
})
