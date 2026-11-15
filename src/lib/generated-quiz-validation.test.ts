import { beforeEach, expect, it, vi } from "vitest"
import { validateGeneratedQuiz } from "./generated-quiz-validation"
import { parseQuizDraft } from "./module-recreation-input"
const chat = vi.hoisted(() => vi.fn())
vi.mock("@/lib/ai/openai", () => ({ chatJson: chat }))
const written = { kind: "written", question: "Show your calculation. [5 marks]", marks: 5, difficulty: "medium", options: [], correctOption: "", modelAnswer: "The worked calculation.", rubric: [{ criterion: "Method", marks: 3 }, { criterion: "Answer", marks: 2 }] }
const choice = { kind: "mcq", question: "Choose two", marks: 1, difficulty: "medium", options: ["1", "2"], correctOption: "2" }
beforeEach(() => vi.resetAllMocks())
it("accepts valid drafts without a repair call", async () => {
  expect(await validateGeneratedQuiz([written, choice], "context")).toEqual(parseQuizDraft([written, choice]))
  expect(chat).not.toHaveBeenCalled()
})
it("normalizes integer strings only during generation, while save validation remains strict", async () => {
  const generated = { ...written, marks: "5", rubric: [{ criterion: "Method", marks: "3" }, { criterion: "Answer", marks: "2" }] }
  expect(await validateGeneratedQuiz([generated], "context")).toEqual(parseQuizDraft([written]))
  expect(() => parseQuizDraft([generated])).toThrow()
  expect(chat).not.toHaveBeenCalled()
})
it("repairs only invalid grading guides and ignores proposed changes to wording or totals", async () => {
  chat.mockResolvedValue({ repairs: [{ index: 1, question: "Changed", marks: 3, modelAnswer: written.modelAnswer, rubric: written.rubric }] })
  const result = await validateGeneratedQuiz([choice, { ...written, rubric: [{ criterion: "Method", marks: 3 }] }], "teaching material")
  expect(result).toEqual(parseQuizDraft([choice, written]))
  const request = JSON.parse(chat.mock.calls[0][0].user)
  expect(request.invalidQuestions).toHaveLength(1)
  expect(request.invalidQuestions[0].problem).toContain("3 marks, but the question is worth 5")
})
it("repairs missing model answers and null rubric entries without crashing", async () => {
  chat.mockResolvedValue({ repairs: [{ index: 0, modelAnswer: written.modelAnswer, rubric: written.rubric }] })
  expect(await validateGeneratedQuiz([{ ...written, modelAnswer: "", rubric: [null] }], "context")).toEqual(parseQuizDraft([written]))
  expect(() => parseQuizDraft([{ ...written, rubric: [null] }])).toThrow("rubric criteria")
})
it("does not accept invalid totals after repair or silently alter the maximum marks", async () => {
  chat.mockResolvedValue({ repairs: [{ index: 0, marks: 3, modelAnswer: "Solution", rubric: [{ criterion: "Method", marks: 3 }] }] })
  await expect(validateGeneratedQuiz([{ ...written, rubric: [{ criterion: "Method", marks: 3 }] }], "context")).rejects.toThrow("Question 1")
  expect(chat).toHaveBeenCalledTimes(2)
})
it("rejects duplicate repair indices instead of overwriting the wrong question", async () => {
  chat.mockResolvedValue({ repairs: [{ index: 0, modelAnswer: "Solution", rubric: written.rubric }, { index: 0, modelAnswer: "Solution", rubric: written.rubric }] })
  await expect(validateGeneratedQuiz([{ ...written, modelAnswer: "" }, { ...written, modelAnswer: "" }], "context")).rejects.toThrow("model answer")
})
