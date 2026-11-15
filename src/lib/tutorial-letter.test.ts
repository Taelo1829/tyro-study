import { beforeEach, expect, it, vi } from "vitest"
import { createHash } from "node:crypto"
import type { TutorialPlan } from "./tutorial-letter-types"
import { explicitTutorialReading, tutorialCheckpointIndex } from "./tutorial-letter-types"
import { applyTutorialLetter, draftTutorialTask, getTutorialGuide, outlineTutorialLetter, validateTutorialPlan, verifiedQuote } from "./tutorial-letter"

const m = vi.hoisted(() => ({ chat: vi.fn(), writer: vi.fn(), query: vi.fn(), execute: vi.fn(), snapshot: vi.fn(), createChapter: vi.fn(), deleteChapters: vi.fn(), createTopic: vi.fn(), moveTopic: vi.fn(), createQuestions: vi.fn(), detachQuestions: vi.fn(), answers: vi.fn(), transaction: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: m.query, $executeRaw: m.execute, $transaction: m.transaction } }))
vi.mock("@/lib/ai/openai", () => ({ chatJson: m.chat }))
vi.mock("@/lib/ai/writers", () => ({ writeLessonHtml: m.writer, LENGTH_GUIDE: { standard: "approximately 2,500 readable characters" } }))
const source = { name: "letter.pdf", text: "Study binary numbers first. Then study memory. Submit assignment one after both units." }
const catalog = [{ ref: "1", title: "Numbers", topics: [{ ref: "1.1", title: "Binary" }] }, { ref: "2", title: "Memory", topics: [{ ref: "2.1", title: "Cache" }] }]
function plan(): TutorialPlan {
  return { guide: { sourceName: "", year: "2022", moduleCode: "COS2621", book: "Prescribed book, 10th edition", contentsSource: "contents.pdf", notes: [{ text: "Start with numbers", evidence: "Study binary numbers first." }], studyPlan: [{ period: "Weeks 1–8", reading: "Numbers", evidence: "Study binary numbers first." }], assessments: [{ title: "Assignment 1", format: "written", selfTest: false, chapterRefs: ["1", "2"], instructions: "Explain binary numbers and memory.", evidence: "Submit assignment one after both units.", weight: "30%" }], warnings: [] }, chapters: structuredClone(catalog), retainedAssignments: [] }
}
beforeEach(() => {
  vi.resetAllMocks()
  m.createChapter.mockImplementation(async ({ data }) => ({ id: `new-${data.order}` }))
  m.createTopic.mockImplementation(async ({ data }) => ({ id: `topic-${data.chapterId}-${data.order}` }))
  m.transaction.mockImplementation(fn => fn({ $queryRaw: m.query, $executeRaw: m.execute, module: { findUniqueOrThrow: m.snapshot }, chapter: { create: m.createChapter, deleteMany: m.deleteChapters }, topic: { create: m.createTopic, update: m.moveTopic }, question: { createMany: m.createQuestions, updateMany: m.detachQuestions }, answer: { createMany: m.answers } }))
})
it("places checkpoints after every prerequisite in actual module order", () => {
  expect(tutorialCheckpointIndex(catalog, ["2", "1"])).toBe(1)
  expect(() => tutorialCheckpointIndex(catalog, ["missing"])).toThrow()
  expect(() => tutorialCheckpointIndex(catalog, [])).toThrow()
})
it("retains book appendix prerequisites and explicit assignment dependencies from the letter", () => {
  const letter = "ASSIGNMENT 01 Exercise\nGuide 102: Appendices A & B\nStallings: Chapters 0, 1, 2, 3, 9 and 11\nAppendix B\nThis assignment serves as preparation for Assignment 02.\nASSIGNMENT 02\nGuide 102: Appendices A–F\nStallings: Chapters 4, 5 and 13\n"
  expect(explicitTutorialReading("Assignment 01", letter)).toMatchObject({ refs: ["0", "1", "2", "3", "9", "11", "B"], preparesFor: "Assignment 2" })
  expect(explicitTutorialReading("Assignment 02", letter)).toMatchObject({ refs: ["4", "5", "13"], preparesFor: null })
  expect(letter).toContain(explicitTutorialReading("Assignment 01", letter).evidence)
})
it("normalizes numeric chapter refs and anchors assignments to source headings without inventing Chapter 0", async () => {
  const letter = { name: "letter.pdf", text: `${source.text}\n5.1 Prescribed book(s)\nWilliam Stallings. Computer Organization and Architecture. Tenth edition. Global Edition.\n5.2 Recommended book(s)\nASSIGNMENT 01 Exercise\nStallings: Chapters 0, 1 and 2\nAppendix B\nSubmit written work.` }
  const raw = { ...plan(), chapters: [{ ref: 0 }, { ref: 1 }, { ref: 2 }] }
  raw.guide.assessments[0].evidence = "A retyped heading with omitted words"
  m.chat.mockResolvedValue(raw)
  const result = await outlineTutorialLetter("COS2621 - Computer Organisation", letter)
  expect(result.chapters.map(c => c.ref)).toEqual(["1", "2", "B"])
  expect(result.guide.assessments[0].chapterRefs).toEqual(["1", "2", "B"])
  expect(letter.text).toContain(result.guide.assessments[0].evidence)
  expect(result.guide.warnings.join(" ")).toContain("Chapter 0")
  expect(m.chat).toHaveBeenCalledOnce()
})
it("restores verified book titles, sections and order and labels historical guidance", () => {
  const draft = plan()
  draft.chapters.reverse(); draft.chapters[0].title = "Hallucinated title"
  const result = validateTutorialPlan(draft, source, catalog, [])
  expect(result.chapters).toEqual(catalog)
  expect(result.guide.sourceName).toBe(source.name)
  expect(result.guide.warnings.join(" ")).toContain("2022")
})
it("rejects fabricated quotes, out-of-syllabus chapters and forgotten uploaded assignments", () => {
  const draft = plan(); draft.guide.notes[0].evidence = "A fabricated quote that never appeared."
  expect(() => validateTutorialPlan(draft, source, catalog, [])).toThrow("verified")
  const missing = plan(); missing.chapters[0].ref = "99"
  expect(() => validateTutorialPlan(missing, source, catalog, [])).toThrow("missing")
  expect(() => validateTutorialPlan(plan(), source, catalog, ["existing"])).toThrow("retained")
  expect(verifiedQuote("Study binary numbers first.", source.text)).toBe(true)
  expect(verifiedQuote("Study binary numbers after both units.", source.text)).toBe(false)
  expect(verifiedQuote("Study binary numbers first.", "Study bi\nnary numbers first\n•")).toBe(true)
})
const q = { question: "Which value is binary?", options: ["10", "2"], correctOption: "10", kind: "mcq", difficulty: "medium", marks: 1 }
const topicQuestions = Array.from({ length: 20 }, (_, i) => ({ ...q, question: `Topic question ${i + 1}` }))
function setupApply(options: { uploaded?: boolean; incomplete?: boolean; stale?: boolean; applied?: boolean; shortQuiz?: boolean } = {}) {
  const p = plan()
  if (options.uploaded) p.retainedAssignments = [{ id: "existing-upload", title: "Uploaded assignment", chapterRefs: ["1", "2"] }]
  const snapshot = { id: "mod", title: "COS2621", chapters: [{ id: "old", topics: [] }], assessmentConfig: null }
  const drafts = { "lesson-0-0": { html: "<p>Binary lesson</p>", questions: topicQuestions }, "lesson-1-0": { html: "<p>Memory lesson</p>", questions: topicQuestions }, ...(!options.uploaded && !options.incomplete ? { "assessment-0": { html: "<p>Practice assignment</p>", questions: [q] } } : {}) }
  if (options.shortQuiz) drafts["lesson-0-0"].questions = [q]
  const data = { plan: p, source, drafts, version: options.stale ? "old-version" : createHash("sha256").update(JSON.stringify(snapshot)).digest("hex") }
  m.query.mockResolvedValueOnce([{ id: "mod" }]).mockResolvedValueOnce([{ data: JSON.stringify(data), applied: options.applied ?? false }]).mockResolvedValueOnce([{ assessmentConfig: null }])
  m.snapshot.mockResolvedValue({ id: snapshot.id, title: snapshot.title, chapters: snapshot.chapters })
}
it("blocks incomplete or stale drafts before modifying any chapter", async () => {
  setupApply({ incomplete: true })
  await expect(applyTutorialLetter("mod", "draft")).rejects.toThrow("Finish every")
  expect(m.createChapter).not.toHaveBeenCalled(); expect(m.deleteChapters).not.toHaveBeenCalled()
})
it("rejects edits made after the import preview", async () => {
  setupApply({ stale: true })
  await expect(applyTutorialLetter("mod", "draft")).rejects.toThrow("changed")
  expect(m.createChapter).not.toHaveBeenCalled()
})
it("blocks applying old topic quizzes with fewer than 20 questions", async () => {
  setupApply({ shortQuiz: true })
  await expect(applyTutorialLetter("mod", "draft")).rejects.toThrow("20 quiz questions")
  expect(m.createChapter).not.toHaveBeenCalled()
})
it("retains and repositions uploaded assignments without generating letter assignments", async () => {
  setupApply({ uploaded: true })
  await applyTutorialLetter("mod", "draft")
  expect(m.moveTopic).toHaveBeenCalledWith({ where: { id: "existing-upload" }, data: expect.objectContaining({ chapterId: "new-1", order: 1 }) })
  expect(m.createTopic).toHaveBeenCalledTimes(2)
  expect(m.moveTopic.mock.invocationCallOrder[0]).toBeLessThan(m.deleteChapters.mock.invocationCallOrder[0])
  expect(m.detachQuestions).toHaveBeenLastCalledWith(expect.objectContaining({ data: { topicId: null, chapterId: null } }))
})
it("generates letter checkpoints when no assignments have been uploaded", async () => {
  setupApply({})
  await applyTutorialLetter("mod", "draft")
  expect(m.createTopic.mock.calls[2][0].data).toMatchObject({ chapterId: "new-1", order: 1, title: "Assignment quiz: Practice: Assignment 1" })
  expect(m.createQuestions).toHaveBeenCalledOnce()
})
it("applying the same import twice is idempotent", async () => {
  setupApply({ applied: true })
  await expect(applyTutorialLetter("mod", "draft")).resolves.toEqual({ applied: true })
  expect(m.createChapter).not.toHaveBeenCalled()
})
it("student guide excludes source documents, answers and private rubrics", async () => {
  const guide = plan().guide
  m.query.mockResolvedValue([{ data: JSON.stringify({ plan: { guide }, source, drafts: { secret: "private rubric" } }) }])
  expect(await getTutorialGuide("mod")).toEqual(guide)
})

it("retries an incorrect question format and saves only the validated written draft", async () => {
  const data = { plan: plan(), source, drafts: {}, uploadedQuestions: [] }
  m.query.mockResolvedValue([{ data: JSON.stringify(data), applied: false }])
  m.writer.mockResolvedValue("<p>Binary numbers use two digits.</p>")
  const writtenBatch = (offset: number) => Array.from({ length: 10 }, (_, i) => ({ question: `Explain binary conversion ${offset + i}. Upload your working.`, kind: "written", difficulty: "medium", marks: 2, options: [], correctOption: "", modelAnswer: "Private answer", rubric: [{ criterion: "Working", marks: 2 }] }))
  m.chat.mockResolvedValueOnce({ questions: topicQuestions.slice(0, 10) }).mockResolvedValueOnce({ questions: writtenBatch(0) }).mockResolvedValueOnce({ questions: writtenBatch(10) })
  await draftTutorialTask("mod", "draft", "lesson-0-0")
  expect(m.chat).toHaveBeenCalledTimes(3)
  expect(m.execute).toHaveBeenCalledOnce()
  expect(m.execute.mock.calls[0][2]).toContain("Private answer")
  expect(JSON.parse(m.execute.mock.calls[0][2]).questions).toHaveLength(20)
  expect(m.createTopic).not.toHaveBeenCalled()
})

it("failed generation saves nothing and retains existing drafts for retry", async () => {
  const data = { plan: plan(), source, drafts: { "lesson-0-0": { html: "Complete", questions: topicQuestions } }, uploadedQuestions: [] }
  m.query.mockResolvedValue([{ data: JSON.stringify(data), applied: false }])
  m.writer.mockResolvedValue("<p>Memory content.</p>")
  m.chat.mockRejectedValue(new Error("Connection failed"))
  await expect(draftTutorialTask("mod", "draft", "lesson-1-0")).rejects.toThrow("Connection failed")
  expect(m.execute).not.toHaveBeenCalled()
  await draftTutorialTask("mod", "draft", "lesson-0-0")
  expect(m.writer).toHaveBeenCalledOnce()
})

it("upgrades a short quiz to 20 questions while reusing its completed lesson", async () => {
  const p = plan(); p.guide.assessments = []
  const data = { plan: p, source, drafts: { "lesson-0-0": { html: "<p>Keep this lesson.</p>", questions: [q] } }, uploadedQuestions: [] }
  m.query.mockResolvedValue([{ data: JSON.stringify(data), applied: false }])
  m.chat.mockResolvedValueOnce({ questions: topicQuestions.slice(0, 10) }).mockResolvedValueOnce({ questions: topicQuestions.slice(10) })
  await draftTutorialTask("mod", "draft", "lesson-0-0")
  const saved = JSON.parse(m.execute.mock.calls[0][2])
  expect(saved.html).toBe("<p>Keep this lesson.</p>")
  expect(saved.questions).toHaveLength(20)
  expect(m.writer).not.toHaveBeenCalled()
  expect(JSON.parse(m.chat.mock.calls[1][0].user).existingQuestions).toHaveLength(10)
})

it("rejects duplicate questions across batches and does not save an incomplete quiz", async () => {
  const p = plan(); p.guide.assessments = []
  m.query.mockResolvedValue([{ data: JSON.stringify({ plan: p, source, drafts: {}, uploadedQuestions: [] }), applied: false }])
  m.writer.mockResolvedValue("<p>Lesson.</p>")
  m.chat.mockResolvedValue({ questions: topicQuestions.slice(0, 10) })
  await expect(draftTutorialTask("mod", "draft", "lesson-0-0")).rejects.toThrow("distinct")
  expect(m.execute).not.toHaveBeenCalled()
})
