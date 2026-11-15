import { beforeEach, expect, it, vi } from "vitest"
import { lessonVersion } from "./module-recreation"
import { assignmentPlacement, assignmentQuizQuestions, saveUploadedAssignment, draftUploadedAssignment, extractUploadedAssignment } from "./uploaded-assignment"
const m = vi.hoisted(() => ({ chat: vi.fn(), transaction: vi.fn(), query: vi.fn(), existing: vi.fn(), chapters: vi.fn(), createTopic: vi.fn(), createQuestion: vi.fn(), createAnswers: vi.fn(), updateTopic: vi.fn(), oldQuestions: vi.fn(), execute: vi.fn(), findTopic: vi.fn(), updateContent: vi.fn() }))
vi.mock("@/lib/ai/openai", () => ({ chatJson: m.chat }))
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: m.transaction } }))
const chapters = [{ id: "ch1", title: "Basics", topics: [{ id: "t1", title: "Functions", order: 0 }] }, { id: "ch2", title: "Loops", topics: [{ id: "t2", title: "Iteration", order: 2 }] }, { id: "ch3", title: "Later", topics: [{ id: "t3", title: "Objects", order: 0 }] }]
const source = { name: "Assignment 1.pdf", text: "Choose a function. Write a function. Repeat its calculation using a loop." }
const matches = [{ topicId: "t2", evidence: "using a loop", questionNumbers: [2], learningGoals: ["Iteration"] }, { topicId: "t1", evidence: "Write a function", questionNumbers: [1], learningGoals: ["Functions"] }]
const questions = [{ kind: "mcq", question: "Choose a function", difficulty: "medium", marks: 1, options: ["First", "Second"], correctOption: "Second" }, { kind: "written", question: "Write a function", difficulty: "medium", marks: 20, rubric: [{ criterion: "Function", marks: 20 }], modelAnswer: "Private solution" }]
beforeEach(() => {
 vi.resetAllMocks()
 m.chat.mockResolvedValue({ corrections: [] })
 m.query.mockResolvedValue([{ id: "mod" }]); m.existing.mockResolvedValue(null); m.chapters.mockResolvedValue(chapters); m.createQuestion.mockResolvedValue({ count: 2 }); m.oldQuestions.mockResolvedValue([{ id: "old" }])
 m.transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({ $queryRaw: m.query, topic: { findUnique: m.existing, create: m.createTopic, update: m.updateTopic, findFirst: m.findTopic, updateMany: m.updateContent }, chapter: { findMany: m.chapters }, question: { createMany: m.createQuestion, findMany: m.oldQuestions }, answer: { createMany: m.createAnswers }, $executeRaw: m.execute }))
})
it("places one assignment after the last related chapter in module order", () => {
 expect(assignmentPlacement(matches, source, chapters)).toEqual({ afterChapterId: "ch2", chapters: [{ id: "ch1", title: "Basics" }, { id: "ch2", title: "Loops" }] })
})
it("rejects unrelated topics and invented source evidence", () => {
 expect(() => assignmentPlacement([], source, chapters)).toThrow("could not be matched")
 expect(() => assignmentPlacement([{ topicId: "outside", evidence: "Write a function" }], source, chapters)).toThrow()
 expect(() => assignmentPlacement([{ topicId: "t1", evidence: "A quote not in the document" }], source, chapters)).toThrow()
})
it("preserves per-question types and validates answers and rubrics", () => {
 expect(assignmentQuizQuestions(questions).map(q => q.kind)).toEqual(["mcq", "written"])
 expect(() => assignmentQuizQuestions([{ ...questions[0], correctOption: "Missing" }])).toThrow()
 expect(() => assignmentQuizQuestions([{ ...questions[1], marks: 10 }])).toThrow()
})
it("saves at the end of the matched chapter with a private marking guide", async () => {
 const saved = await saveUploadedAssignment("mod", source, "Assignment 1", matches, questions)
 expect(saved.chapterId).toBe("ch2")
 const topic = m.createTopic.mock.calls[0][0].data
 expect(topic).toMatchObject({ chapterId: "ch2", order: 3, title: "Assignment quiz: Assignment 1" })
 expect(topic.content).toContain("all 2 questions")
 expect(topic.content).not.toContain("Private solution")
 expect(m.createQuestion.mock.calls[0][0].data.map((q: { question: string }) => q.question)).toEqual(questions.map(q => q.question))
 expect(m.createAnswers.mock.calls[0][0].data.map((a: { answer: string }) => a.answer)).toEqual(["First", "Second"])
 expect(m.execute).toHaveBeenCalledOnce()
})
it("does not add a duplicate assignment when retrying save", async () => {
 m.existing.mockResolvedValue({ id: "already", chapterId: "ch2", title: "Assignment quiz: Assignment 1" })
 expect(await saveUploadedAssignment("mod", source, "Assignment 1", matches, questions)).toEqual({ topicId: "already", chapterId: "ch2", alreadyAdded: true })
 expect(m.createTopic).not.toHaveBeenCalled()
 expect(m.createQuestion).not.toHaveBeenCalled()
})
it("revalidates chapter matches at save time", async () => {
 m.chapters.mockResolvedValue([])
 await expect(saveUploadedAssignment("mod", source, "Assignment 1", matches, questions)).rejects.toThrow()
 expect(m.createTopic).not.toHaveBeenCalled()
})

it("compares the full chapter outline for each question rather than accepting one broad introductory match", async () => {
 m.chat.mockResolvedValueOnce({ title: "Assignment", questions })
  .mockResolvedValueOnce({ matches: [
   { topicId: "t1", questionNumber: 1, assessedConcept: "Functions", learningGoals: ["Functions"] },
   { topicId: "t2", questionNumber: 2, assessedConcept: "Iteration", learningGoals: ["Iteration"] },
  ] })
 const result = await draftUploadedAssignment(source, chapters)
 expect(result.placement.afterChapterId).toBe("ch2")
 expect(result.coverage.map(c => c.topicId)).toEqual(["t1", "t2"])
 expect(JSON.parse(m.chat.mock.calls[1][0].user).chapters).toHaveLength(3)
 expect(m.chat).toHaveBeenCalledTimes(3)
})

it("converts a previous document checkpoint into a quiz while retaining answer history", async () => {
 m.existing.mockResolvedValue({ id: "old-topic", chapterId: "ch2", title: "Assignment checkpoint: Assignment 1" })
 await saveUploadedAssignment("mod", source, "Assignment 1", matches, questions)
 expect(m.createTopic).not.toHaveBeenCalled()
 expect(m.updateTopic.mock.calls[0][0].data.title).toBe("Assignment quiz: Assignment 1")
 expect(JSON.parse(m.execute.mock.calls[0][1]).retiredQuestionIds).toContain("old")
 expect(m.createQuestion).toHaveBeenCalledOnce()
})

const topicSnapshots = [
 { id: "t1", title: "Functions", chapterId: "ch1", content: "<p>Original functions lesson</p>" },
 { id: "t2", title: "Iteration", chapterId: "ch2", content: "<p>Original loops lesson</p>" },
]
const lessonDrafts = topicSnapshots.map(t => ({ topicId: t.id, version: lessonVersion(t), html: "<p>Updated " + t.title + " lesson</p>" }))
it("updates targeted lessons in the same transaction as the uploaded quiz", async () => {
 m.findTopic.mockImplementation(({ where }: { where: { id: string } }) => Promise.resolve(topicSnapshots.find(t => t.id === where.id)))
 m.updateContent.mockResolvedValue({ count: 1 })
 await saveUploadedAssignment("mod", source, "Assignment", matches, questions, lessonDrafts)
 expect(m.updateContent).toHaveBeenCalledTimes(2)
 expect(m.updateContent).toHaveBeenCalledWith({ where: topicSnapshots[0], data: { content: lessonDrafts[0].html } })
 expect(m.createTopic).toHaveBeenCalledOnce()
 expect(m.transaction).toHaveBeenCalledOnce()
})
it("rejects missing or unrelated lesson replacements", async () => {
 await expect(saveUploadedAssignment("mod", source, "Assignment", matches, questions, [lessonDrafts[0]])).rejects.toThrow("every targeted topic")
 await expect(saveUploadedAssignment("mod", source, "Assignment", matches, questions, [lessonDrafts[0], { ...lessonDrafts[1], topicId: "t3" }])).rejects.toThrow("every targeted topic")
 expect(m.createTopic).not.toHaveBeenCalled()
 expect(m.updateContent).not.toHaveBeenCalled()
})
it("rejects stale lesson drafts before creating the quiz", async () => {
 m.findTopic.mockResolvedValue({ ...topicSnapshots[0], content: "A newer edit" })
 await expect(saveUploadedAssignment("mod", source, "Assignment", matches, questions, lessonDrafts)).rejects.toThrow("changed after drafting")
 expect(m.createTopic).not.toHaveBeenCalled()
 expect(m.updateContent).not.toHaveBeenCalled()
})
it("allows re-uploading an existing quiz to update its targeted lessons", async () => {
 m.existing.mockResolvedValue({ id: "already", chapterId: "ch2", title: "Assignment quiz: Assignment" })
 m.findTopic.mockImplementation(({ where }: { where: { id: string } }) => Promise.resolve(topicSnapshots.find(t => t.id === where.id)))
 m.updateContent.mockResolvedValue({ count: 1 })
 expect(await saveUploadedAssignment("mod", source, "Assignment", matches, questions, lessonDrafts)).toMatchObject({ alreadyAdded: true })
 expect(m.updateContent).toHaveBeenCalledTimes(2)
 expect(m.createQuestion).not.toHaveBeenCalled()
})
it("does not overwrite a concurrent lesson change", async () => {
 m.findTopic.mockResolvedValue(topicSnapshots[0])
 m.updateContent.mockResolvedValue({ count: 0 })
 await expect(saveUploadedAssignment("mod", source, "Assignment", matches, questions, lessonDrafts)).rejects.toThrow("changed while saving")
 expect(m.createTopic).not.toHaveBeenCalled()
})


it("moves a re-uploaded quiz after the last related chapter without recreating questions", async () => {
 m.existing.mockResolvedValue({ id: "already", chapterId: "ch1", title: "Assignment quiz: Assignment 1" })
 const result = await saveUploadedAssignment("mod", source, "Assignment 1", matches, questions)
 expect(result).toMatchObject({ chapterId: "ch2", alreadyAdded: true })
 expect(m.updateTopic).toHaveBeenCalledWith({ where: { id: "already" }, data: { chapterId: "ch2", order: 3 } })
 expect(m.createQuestion).not.toHaveBeenCalled()
})

it("extracts long numbered papers in batches without losing duplicates or marks", async () => {
 const paper = { name: "Long.pdf", text: Array.from({ length: 60 }, (_, i) => `Question ${i + 1}\nMarked out of 2.00\nChoose a function.\n`).join("") }
 m.chat.mockImplementation(async ({ user }: { user: string }) => {
  const input = JSON.parse(user)
  if (input.proposedMatches) return { corrections: [] }
  if (input.requestedQuestions) return { title: "Long assignment", questions: input.requestedQuestions.map((q: { number: number }) => ({ ...questions[0], marks: 2, sourceNumber: q.number })) }
  return { matches: input.questions.map((q: { number: number }) => ({ topicId: "t1", questionNumber: q.number, assessedConcept: "Functions", learningGoals: ["Functions"] })) }
 })
 const result = await draftUploadedAssignment(paper, chapters)
 expect(result.questions).toHaveLength(60)
 expect(result.questions.reduce((sum, q) => sum + q.marks!, 0)).toBe(120)
 expect(m.chat.mock.calls.filter(([call]) => JSON.parse(call.user).requestedQuestions)).toHaveLength(6)
})
it("refuses a partial extraction rather than saving an incomplete quiz", async () => {
 const paper = { name: "a.pdf", text: "Question 1\nMarked out of 2.00\nChoose a function.\nQuestion 2\nMarked out of 2.00\nChoose another function." }
 m.chat.mockResolvedValue({ title: "Incomplete", questions: [{ ...questions[0], marks: 2, sourceNumber: 1 }] })
 await expect(draftUploadedAssignment(paper, chapters)).rejects.toThrow("question numbers or marks")
 expect(m.createTopic).not.toHaveBeenCalled()
})


it("keeps original PDF options while resolving the generated answer by index", async () => {
 const paper = { name: "a.pdf", text: "Question 1\nNot yet answered\nMarked out of 2.00\nWhich choice applies?\na. CPU\nb. all of the above" }
 m.chat.mockResolvedValue({ title: "Assignment", questions: [{ ...questions[0], sourceNumber: 1, marks: 2, correctOption: "All of the above.", correctOptionIndex: 1 }] })
 const result = await extractUploadedAssignment(paper)
 expect(result.questions[0]).toMatchObject({ question: "Which choice applies?", options: ["CPU", "all of the above"], correctOption: "all of the above", marks: 2 })
})
it("gives a specific failed answer reference to the extraction retry", async () => {
 const paper = { name: "a.pdf", text: "Question 1\nMarked out of 2.00\nWhich choice applies?\na. CPU\nb. Memory" }
 m.chat.mockResolvedValueOnce({ title: "Assignment", questions: [{ ...questions[0], sourceNumber: 1, marks: 2, correctOption: "Unknown" }] })
  .mockResolvedValueOnce({ title: "Assignment", questions: [{ ...questions[0], sourceNumber: 1, marks: 2, correctOption: "Memory", correctOptionIndex: 1 }] })
 const result = await extractUploadedAssignment(paper)
 expect(result.questions[0].correctOption).toBe("Memory")
 expect(JSON.parse(m.chat.mock.calls[1][0].user).retry).toContain("Question 1")
})

it("reports the original question number for invalid choices in later batches", () => {
 expect(() => assignmentQuizQuestions([{ ...questions[0], sourceNumber: 21, options: ["Duplicate", "Duplicate"], correctOption: "Duplicate" }])).toThrow("Question 21")
})
