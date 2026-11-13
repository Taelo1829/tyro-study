import { beforeEach, expect, it, vi } from "vitest"
import { analyseAssignments, assignmentQuizPlans, fallbackAssignmentFormat, writeAssignmentCheckpoint } from "./assignment-quiz-format"
const chat = vi.hoisted(() => vi.fn())
vi.mock("@/lib/ai/openai", () => ({ chatJson: chat }))
beforeEach(() => vi.resetAllMocks())
it.each(["a) First b) Second c) Third d) Fourth", "A. First\nB. Second\nC. Third\nD. Fourth", "(a) First (b) Second (c) Third (d) Fourth"])("recognizes ordered choices: %s", (text: string) => {
 expect(fallbackAssignmentFormat({ name: "assignment", text })).toBe("mcq")
})
it("requires evidence for written format and favors choices when both signals occur", () => {
 expect(fallbackAssignmentFormat({ name: "a", text: "Submit your answers as a PDF document." })).toBe("written")
 expect(fallbackAssignmentFormat({ name: "a", text: "Write about functions." })).toBeNull()
 expect(fallbackAssignmentFormat({ name: "a", text: "Submit a PDF. a) yes b) no c) maybe d) neither" })).toBe("mcq")
 expect(fallbackAssignmentFormat({ name: "a", text: "a) one b) two" })).toBeNull()
 expect(fallbackAssignmentFormat({ name: "exam", kind: "exam", text: "Upload a document" })).toBeNull()
})
it("continues with per-topic fallback after a classifier failure", async () => {
 chat.mockRejectedValue(new Error("Unavailable"))
 const sources = [{ name: "a", text: "Submit a document" }]
 const result = await analyseAssignments(sources, [{ id: "t", title: "Functions", chapter: "Code" }])
 expect(result.analysis.unresolved).toEqual([0])
 expect(assignmentQuizPlans(result.analysis, sources, ["t"])).toEqual({})
})
it("uses the entire assignment format for each covered topic", () => {
 const source = { name: "a", text: "Choice questions about functions" }
 const analysis = { assignments: [{ sourceIndex: 0, format: "mcq", evidence: "Choice questions", topics: [{ topicId: "t", kind: "written", evidence: "functions" }] }] }
 expect(assignmentQuizPlans(analysis, [source], ["t"]).t.kinds).toEqual(["mcq"])
 analysis.assignments[0].format = "written"
 expect(assignmentQuizPlans(analysis, [source], ["t"]).t.kinds).toEqual(["written"])
 analysis.assignments[0].format = "mixed"
 expect(assignmentQuizPlans(analysis, [source], ["t"]).t.kinds).toEqual(["written"])
})
it("does not block lessons on unverifiable classification", async () => {
 chat.mockResolvedValue({ assignments: [{ sourceIndex: 0, format: "mcq", evidence: "invented", topics: [] }] })
 expect((await analyseAssignments([{ name: "a", text: "Upload a PDF" }], [])).analysis.unresolved).toEqual([0])
})

it("rejects MCQ and multi-question drafts for an assignment checkpoint", async () => {
 chat.mockResolvedValue({ questions: [{ kind: "mcq", question: "Choose a function", difficulty: "medium", options: ["a", "b"], correctOption: "a", marks: 20 }] })
 await expect(writeAssignmentCheckpoint("Functions")).rejects.toThrow("assignment draft")
 const written = { kind: "written", question: "Write a function", difficulty: "medium", marks: 20, modelAnswer: "Solution", rubric: [{ criterion: "Function", marks: 20 }] }
 chat.mockResolvedValue({ questions: [written, written] })
 await expect(writeAssignmentCheckpoint("Functions")).rejects.toThrow("assignment draft")
})
