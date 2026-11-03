import { describe, expect, it } from "vitest"
import { MOCK_EXAM_MAX_SECONDS, mockExamPlan } from "./quiz-stats"

const chapter = (id: string, quizSize: number, estimateSeconds: number) => ({ id, quizSize, estimateSeconds })

describe("mock exam plan (BR-23)", () => {
  it("is null when no chapter has questions", () => {
    expect(mockExamPlan([chapter("a", 0, 0)])).toBeNull()
    expect(mockExamPlan([])).toBeNull()
  })

  it("gives each chapter its chapter-quiz share and time, rounded up to whole 5 minutes", () => {
    const plan = mockExamPlan([chapter("a", 20, 20 * 60), chapter("b", 10, 10 * 90)])!
    expect(plan.perChapter).toEqual([
      { chapterId: "a", questions: 20, seconds: 1200 },
      { chapterId: "b", questions: 10, seconds: 900 },
    ])
    expect(plan.totalQuestions).toBe(30)
    expect(plan.timeLimitSeconds).toBe(2100) // 35 min, already a multiple of 5
    expect(plan.capped).toBe(false)
  })

  it("never allows less than 10 minutes", () => {
    expect(mockExamPlan([chapter("a", 2, 60)])!.timeLimitSeconds).toBe(600)
  })

  it("shrinks every chapter by the same factor to fit 3 hours", () => {
    const plan = mockExamPlan(Array.from({ length: 10 }, (_, i) => chapter(`c${i}`, 20, 20 * 120)))! // 400 min in full
    expect(plan.capped).toBe(true)
    expect(plan.timeLimitSeconds).toBeLessThanOrEqual(MOCK_EXAM_MAX_SECONDS)
    const shares = new Set(plan.perChapter.map(p => p.questions))
    expect(shares.size).toBe(1) // same share for equal chapters
    expect(plan.perChapter.every(p => p.questions >= 1)).toBe(true)
  })
})
