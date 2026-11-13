import { describe, expect, it } from "vitest"
import { mockExamPlan } from "./quiz-stats"
import type { SavedExam } from "./module-assessments"
const exam: SavedExam = { version: "v1", sourceName: "Exam.pdf", durationMinutes: 240, totalQuestions: 2, totalMarks: 4, instructions: "Answer all questions", sections: [
  { title: "Section A", instructions: "", questions: [{ id: "a", label: "1", marks: 2, optionIds: ["a1", "a2"] }] },
  { title: "Section B", instructions: "", questions: [{ id: "b", label: "2", marks: 2, optionIds: ["b1", "b2"] }] },
] }
describe("strict source mock plan", () => {
  it("has no fallback when a source exam is absent", () => {
    expect(mockExamPlan(null)).toBeNull()
    expect(mockExamPlan(undefined)).toBeNull()
  })
  it("preserves source duration without the old three-hour cap", () => {
    const plan = mockExamPlan(exam)!
    expect(plan.timeLimitSeconds).toBe(240 * 60)
    expect(plan.capped).toBe(false)
    expect(plan.totalMarks).toBe(4)
    expect(plan.sections?.map(s => s.title)).toEqual(["Section A", "Section B"])
  })
  it("rejects incomplete counts and mark totals", () => {
    expect(mockExamPlan({ ...exam, totalQuestions: 3 })).toBeNull()
    expect(mockExamPlan({ ...exam, totalMarks: 10 })).toBeNull()
  })
})
