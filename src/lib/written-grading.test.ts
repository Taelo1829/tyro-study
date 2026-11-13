import { expect, it, vi } from "vitest"
import { parseSubmissionPages, validateWrittenGrade } from "./written-grading"
import { quizMarkTotal, publicQuestion } from "./written-quizzes"
import { parseQuizDraft } from "./module-recreation-input"
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
const rubric = [{ criterion: "Method", marks: 3 }, { criterion: "Answer", marks: 2 }]
const response = { readable: true, summary: "Good method; check arithmetic.", transcription: "x = 4", awards: [{ index: 0, marks: 3, feedback: "Method correct" }, { index: 1, marks: 0.5, feedback: "Arithmetic error" }] }
it("awards bounded partial credit and weights the overall quiz by marks", () => {
 const grade = validateWrittenGrade(response, rubric, "x = 5")
 expect(grade.earnedMarks).toBe(3.5)
 const total = quizMarkTotal([{ id: "w", maxMarks: 5 }, { id: "m", maxMarks: 1 }], [{ questionId: "w", status: "ANSWERED", isCorrect: false }, { questionId: "m", status: "ANSWERED", isCorrect: true }], new Map([["w", grade]]))
 expect(total).toEqual({ earnedMarks: 4.5, totalMarks: 6, score: 75 })
})
it("does not award guessed marks for unreadable work or invalid rubric awards", () => {
 expect(() => validateWrittenGrade({ ...response, readable: false }, rubric, "answer")).toThrow("no mark")
 expect(() => validateWrittenGrade({ ...response, awards: [{ ...response.awards[0], marks: 100 }, response.awards[1]] }, rubric, "answer")).toThrow()
 expect(() => validateWrittenGrade({ ...response, awards: [response.awards[0], response.awards[0]] }, rubric, "answer")).toThrow()
})
it("rejects external image URLs, fake files and excessive pages", () => {
 expect(() => parseSubmissionPages([{ image: "https://example.test/private", label: "a" }])).toThrow()
 expect(() => parseSubmissionPages([{ image: "data:image/png;base64,YWJj", label: "a" }])).toThrow()
 expect(() => parseSubmissionPages(new Array(9).fill({}))).toThrow()
 const image = "data:image/jpeg;base64," + Buffer.from([255,216,...new Array(20).fill(0)]).toString("base64")
 expect(parseSubmissionPages([{ image, label: "page 1" }])).toHaveLength(1)
})
it("keeps marking material private until grading", () => {
 expect(publicQuestion({ id: "w", question: "Solve", modelAnswer: "secret", writtenRubric: "private", studyNote: "solution" }, false)).toEqual({ id: "w", question: "Solve" })
})
it("requires a complete written marking rubric", () => {
 const q = { kind: "written", question: "Solve and show your work", difficulty: "medium", marks: 5, rubric, modelAnswer: "A complete worked answer" }
 expect(parseQuizDraft([q])[0]).toMatchObject({ kind: "written", options: [], correctOption: "", marks: 5 })
 expect(() => parseQuizDraft([{ ...q, marks: 6 }])).toThrow()
})
