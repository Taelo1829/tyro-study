import { beforeEach, expect, it, vi } from "vitest"
import { assignmentInventory, verifyAssignmentInventory, mapAssignmentCoverage, verifyQuestionCoverage } from "./assignment-coverage"
const m = vi.hoisted(() => ({ chat: vi.fn() }))
vi.mock("./ai/openai", () => ({ chatJson: m.chat }))
const question = { question: "Which component stores data?", difficulty: "medium" as const, kind: "mcq" as const, marks: 2, options: ["Memory", "Other"], correctOption: "Memory" }
beforeEach(() => { vi.resetAllMocks(); m.chat.mockResolvedValue({ corrections: [] }) })
it("counts all 60 Moodle headers and their original two-mark values", () => {
 const text = Array.from({ length: 60 }, (_, i) => `Question ${i + 1}\nNot yet answered\nMarked out of 2.00\n`).join("") + "Repeated question wording is allowed."
 expect(assignmentInventory(text)).toHaveLength(60)
 expect(assignmentInventory(text).every(q => q.marks === 2)).toBe(true)
 const source = { name: "assignment.pdf", text }
 expect(() => verifyAssignmentInventory(source, Array(60).fill(question))).not.toThrow()
 expect(() => verifyAssignmentInventory(source, Array(57).fill(question))).toThrow("60 questions")
 expect(() => verifyAssignmentInventory(source, Array(60).fill({ ...question, marks: 1 }))).toThrow("2 marks")
})
it("rejects gaps in recognised source numbering", () => {
 expect(() => assignmentInventory("Question 1\nText\nQuestion 3\nText")).toThrow("numbering")
})
it("requires coverage of every question, including the final one", () => {
 expect(() => verifyQuestionCoverage([{ topicId: "t", evidence: "source", questionNumbers: [1, 2], learningGoals: ["Cache"] }], 3)).toThrow("Questions 3")
})
it("matches the specific memory and I/O chapters even when an overview also matches", async () => {
 const chapters = [
  { id: "intro", title: "Introduction", topics: [{ id: "overview", title: "Basic architecture" }] },
  { id: "memory", title: "Computer Memory", topics: [{ id: "cache", title: "Cache Memory" }] },
  { id: "io", title: "Input and Output", topics: [{ id: "interrupts", title: "Interrupts" }] },
 ]
 m.chat.mockResolvedValueOnce({ matches: [
  { topicId: "overview", questionNumber: 1, assessedConcept: "CPU", learningGoals: ["CPU"] },
  { topicId: "cache", questionNumber: 2, assessedConcept: "Caches", learningGoals: ["Cache replacement policies"] },
  { topicId: "interrupts", questionNumber: 3, assessedConcept: "Interrupts", learningGoals: ["Interrupt types"] },
 ] })
 const matches = await mapAssignmentCoverage({ name: "a.pdf", text: "Which component stores data? Describe the CPU, cache replacement policies and interrupt types." }, Array(3).fill(question), chapters)
 expect(matches.map(m => m.topicId)).toEqual(["overview", "cache", "interrupts"])
 expect(m.chat).toHaveBeenCalledTimes(2)
})
it("blocks an invalid topic instead of silently dropping an assessed question", async () => {
 m.chat.mockResolvedValue({ matches: [{ topicId: "invented", questionNumber: 1, assessedConcept: "Cache", learningGoals: ["Cache"] }] })
 await expect(mapAssignmentCoverage({ name: "a.pdf", text: "Describe cache replacement policies." }, [question], [{ id: "ch", title: "Memory", topics: [{ id: "cache", title: "Cache" }] }])).rejects.toThrow("reference")
})

it("reconciles missing concepts into the appropriate existing topic with explicit goals", async () => {
 m.chat.mockResolvedValueOnce({ matches: [
  { questionNumber: 1, topicId: "cache", assessedConcept: "Cache coherence", learningGoals: ["Teach cache coherence and replacement policies"] },
 ] })
 const result = await mapAssignmentCoverage({ name: "a.pdf", text: "Which component stores data? Describe cache coherence and replacement policies." }, [question], [{ id: "memory", title: "Computer Memory", topics: [{ id: "cache", title: "Cache Memory", content: "A short introduction to caches." }] }])
 expect(result[0]).toMatchObject({ topicId: "cache", questionNumbers: [1], learningGoals: ["Teach cache coherence and replacement policies"] })
 expect(m.chat).toHaveBeenCalledTimes(2)
})
it("blocks questions that cannot fit any existing topic instead of using the first chapter", async () => {
 m.chat.mockResolvedValueOnce({ matches: [
  { questionNumber: 1, topicId: null, passageId: "passage-1", learningGoals: [] },
 ] })
 await expect(mapAssignmentCoverage({ name: "a.pdf", text: "Describe an unrelated concept from a different module." }, [question], [{ id: "intro", title: "Introduction", topics: [{ id: "intro-topic", title: "Overview" }] }])).rejects.toThrow("Questions 1")
})

it("removes a false late-chapter match during the final scope review", async () => {
 const qs = [
  { ...question, question: "What is a sequence of program instructions called?" },
  { ...question, question: "Which cache replacement policy removes the least recently used block?" },
 ]
 const chapters = [
  { id: "intro", title: "Introduction", topics: [{ id: "overview", title: "Overview of Computer Systems" }] },
  { id: "memory", title: "Memory", topics: [{ id: "cache", title: "Cache Memory" }] },
  { id: "software", title: "System Software", topics: [{ id: "os", title: "Operating System Functions" }] },
 ]
 m.chat.mockResolvedValueOnce({ matches: [
  { questionNumber: 1, topicId: "os", assessedConcept: "Software", learningGoals: ["Software definition"] },
  { questionNumber: 2, topicId: "cache", assessedConcept: "Cache replacement", learningGoals: ["LRU"] },
 ] }).mockResolvedValueOnce({ corrections: [
  { questionNumber: 1, topicId: "overview", assessedConcept: "Software definition", learningGoals: ["Distinguish software and hardware"] },
 ] })
 const matches = await mapAssignmentCoverage({ name: "a.pdf", text: qs.map(q => q.question).join(" ") }, qs, chapters)
 expect(matches.map(m => m.topicId)).toEqual(["overview", "cache"])
})
