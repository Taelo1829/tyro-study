import { expect, it } from "vitest"
import { paperPageText } from "./paper-page-text"
import { moodleChoiceQuestions, verifyAssignmentInventory } from "./assignment-coverage"
const item = (str: string, y: number, x = 50) => ({ str, hasEOL: true, transform: [1, 0, 0, 1, x, y] })
it("restores question labels beside their own bodies in Moodle PDF reading order", () => {
 const text = paperPageText([
  item("Question 1", 800), item("Marked out of 2.00", 780),
  item("Question 2", 600), item("Marked out of 2.00", 580),
  item("Choose a component.", 760), item("a. Memory", 740), item("b. CPU", 720),
  item("Choose a component.", 560), item("a. CPU", 540), item("b. Memory", 520),
 ])
 const questions = moodleChoiceQuestions(text)!
 expect(questions).toHaveLength(2)
 expect(questions.map(q => q.marks)).toEqual([2, 2])
 expect(questions[0].question).toBe("Choose a component.")
 expect(questions[1].question).toBe("Choose a component.")
 expect(questions.map(q => q.options)).toEqual([["Memory", "CPU"], ["CPU", "Memory"]])
 const parsed = questions.map(q => ({ ...q, difficulty: "medium" as const, kind: "mcq" as const, correctOption: q.options[0] }))
 expect(() => verifyAssignmentInventory({ name: "a.pdf", text }, parsed)).not.toThrow()
 expect(() => verifyAssignmentInventory({ name: "a.pdf", text }, [...parsed].reverse())).toThrow("option order")
})
it("preserves the original reading order for ordinary documents", () => {
 expect(paperPageText([item("Some text", 500), item("More text", 800)])).toBe("Some text\nMore text")
})
it("does not guess MCQ boundaries for unstructured documents", () => {
 expect(moodleChoiceQuestions("Question 1\nMarked out of 10.00\nExplain cache memory.")).toBeNull()
})
