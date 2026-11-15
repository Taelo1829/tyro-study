import { expect, it } from "vitest"
import { assignmentChoiceAnswer } from "./assignment-choice"

it("resolves indexes to the exact original option despite generated formatting", () => {
 expect(assignmentChoiceAnswer(["CPU", "all of the above"], "All of the above.", 1)).toBe("all of the above")
})
it("accepts unambiguous labels and whitespace without changing source wording", () => {
 expect(assignmentChoiceAnswer(["CPU", "main memory"], "b. main memory")).toBe("main memory")
 expect(assignmentChoiceAnswer(["CPU", "main memory"], "Option B")).toBe("main memory")
 expect(assignmentChoiceAnswer(["CPU", "main memory"], "main\n memory")).toBe("main memory")
})
it("rejects conflicting references, invalid indexes and unrecognised answers", () => {
 expect(() => assignmentChoiceAnswer(["CPU", "Memory"], "CPU", 1)).toThrow("disagree")
 expect(() => assignmentChoiceAnswer(["CPU", "Memory"], undefined, 2)).toThrow("out of range")
 expect(() => assignmentChoiceAnswer(["CPU", "Memory"], "Both")).toThrow("could not be matched")
})
it("preserves case-sensitive answers and gives literal options precedence over labels", () => {
 expect(assignmentChoiceAnswer(["a", "A"], "A")).toBe("A")
 expect(assignmentChoiceAnswer(["B", "Other"], "B")).toBe("B")
 expect(() => assignmentChoiceAnswer(["x", "y"], "X")).toThrow()
})
it("rejects ambiguous answer text rather than choosing one duplicate option", () => {
 expect(() => assignmentChoiceAnswer(["same", "same"], "same")).toThrow("multiple")
})
