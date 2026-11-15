import { beforeEach, expect, it, vi } from "vitest"
import { createHash } from "node:crypto"
import type { TutorialPlan } from "./tutorial-letter-types"
import { explicitTutorialReading, tutorialAssessmentEvidence, tutorialCheckpointIndex } from "./tutorial-letter-types"
import { applyTutorialLetter, draftTutorialTask, getTutorialGuide, outlineTutorialLetter, validateTutorialPlan, verifiedQuote, verifiedNoteEvidence } from "./tutorial-letter"

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

// Relevant pdf-parse output from COS2626 TL101 (2026), pages 20–21.
const assessmentSource = `To gain admission to the examination, you must obtain 40% SUB-MINIMUM for the YEAR
MARK.
• The assignment weighting for the module is 20%.

-- 20 of 26 --

COS2626/101/0/2026
21
• You will receive examination information via the myModules sites. Please watch out for
announcements on how examinations for the modules for which you are registered will be
conducted.
• The examination will count 80% towards the final module mark.`
const assessmentQuotes = [
  "To gain admission to the examination, you must obtain 40% SUB-MINIMUM for the YEAR MARK.",
  "The assignment weighting for the module is 20%.",
  "The examination will count 80% towards the final module mark.",
]
const assessmentTable = `Assessment
number
Method of assessment Outcomes covered in
assessment
Weigh
contribution of
assessment
1. Quiz 1 - 2 20%
2. Quiz 3 - 4 20%
3. Written 1 - 7 20%
4. Quiz 5 - 6 20%
5. Quiz (IRIS invigilation quiz) 1 - 7 20%
9.3 Assessment/assignment due dates
• No assessment/assignment due dates are included in this tutorial letter.`
it("anchors each COS2626 assessment to its own exact table row", () => {
  const rows = ["1. Quiz 1 - 2 20%", "2. Quiz 3 - 4 20%", "3. Written 1 - 7 20%", "4. Quiz 5 - 6 20%", "5. Quiz (IRIS invigilation quiz) 1 - 7 20%"]
  for (const [i, row] of rows.entries()) {
    const evidence = tutorialAssessmentEvidence(`Assignment 0${i + 1}`, assessmentTable)
    expect(evidence).toBe(row)
    expect(assessmentTable.includes(evidence!)).toBe(true)
  }
})
it("repairs the rejected header-plus-row quote before validating Assignment 02", () => {
  const draft = plan()
  draft.guide.assessments[0].title = "Assignment 02"
  draft.guide.assessments[0].evidence = "Assessment number Method of assessment Outcomes covered in assessment Weigh contribution of assessment 2. Quiz 3 - 4 20%"
  expect(verifiedQuote(draft.guide.assessments[0].evidence, assessmentTable)).toBe(false)
  const result = validateTutorialPlan(draft, { ...source, text: source.text + "\n" + assessmentTable }, catalog, [])
  expect(result.guide.assessments[0].evidence).toBe("2. Quiz 3 - 4 20%")
})
it.each([
  ["Quiz 1", "1. Quiz 1 - 2 20%"],
  ["Quiz 02", "2. Quiz 3 - 4 20%"],
  ["Written 3", "3. Written 1 - 7 20%"],
  ["Written assignment 03", "3. Written 1 - 7 20%"],
  ["Quiz 4", "4. Quiz 5 - 6 20%"],
  ["Quiz 5 (IRIS invigilation quiz)", "5. Quiz (IRIS invigilation quiz) 1 - 7 20%"],
  ["Quiz No. 1", "1. Quiz 1 - 2 20%"],
])("validates short assessment row evidence for %s", (title, evidence) => {
  expect(tutorialAssessmentEvidence(title, assessmentTable)).toBe(evidence)
  const draft = plan()
  draft.guide.assessments[0].title = title
  draft.guide.assessments[0].evidence = evidence
  expect(validateTutorialPlan(draft, { ...source, text: source.text + "\n" + assessmentTable }, catalog, []).guide.assessments[0].evidence).toBe(evidence)
})
it("does not match a method-specific title to another assessment method", () => {
  expect(tutorialAssessmentEvidence("Quiz 3", assessmentTable)).toBeNull()
  expect(tutorialAssessmentEvidence("Written 1", assessmentTable)).toBeNull()
  expect(tutorialAssessmentEvidence("Quiz 6", assessmentTable)).toBeNull()
})
it("handles wrapped table rows without borrowing another assessment's evidence", () => {
  const wrapped = assessmentTable.replace("2. Quiz 3 - 4 20%", "2.\nQuiz\n3 - 4\n20%")
  expect(tutorialAssessmentEvidence("Assessment 2", wrapped)).toBe("2.\nQuiz\n3 - 4\n20%")
  expect(tutorialAssessmentEvidence("Assignment 06", assessmentTable)).toBeNull()
  expect(tutorialAssessmentEvidence("Assignment 02", "2. Quiz 3 - 4 20%")).toBeNull()
  expect(tutorialAssessmentEvidence("Assignment 02", assessmentTable + "\n" + assessmentTable)).toBeNull()
  const draft = plan()
  draft.guide.assessments[0].title = "Assignment 06"
  draft.guide.assessments[0].evidence = "Invented supporting quote."
  expect(() => validateTutorialPlan(draft, { ...source, text: source.text + "\n" + assessmentTable }, catalog, [])).toThrow("supporting quote")
})
it("verifies the COS2626 assessment note as separate excerpts across pages and intervening text", () => {
  const evidence = assessmentQuotes.join(" ")
  expect(verifiedQuote(evidence, assessmentSource)).toBe(false)
  expect(verifiedNoteEvidence(evidence, assessmentSource)).toEqual(assessmentQuotes)
  const draft = plan()
  draft.guide.notes = [{ text: "Admission needs a 40% year mark; assignments count 20% and the examination 80%.", evidence }]
  const result = validateTutorialPlan(draft, { ...source, text: `${source.text}\n${assessmentSource}` }, catalog, [])
  expect(result.guide.notes[0].evidence).toEqual(assessmentQuotes)
})
it("accepts explicit excerpt arrays and existing single-quote notes", () => {
  expect(verifiedNoteEvidence(assessmentQuotes, assessmentSource)).toEqual(assessmentQuotes)
  expect(verifiedNoteEvidence(assessmentQuotes[0], assessmentSource)).toBe(assessmentQuotes[0])
})
it("rejects a note if any excerpt changes a fact, invents text, or stitches clauses", () => {
  expect(verifiedNoteEvidence(assessmentQuotes.join(" ").replace("80%", "90%"), assessmentSource)).toBeNull()
  expect(verifiedNoteEvidence([...assessmentQuotes, "No assignments are required."], assessmentSource)).toBeNull()
  expect(verifiedNoteEvidence("To gain admission to the examination, the examination will count 80% towards the final module mark.", assessmentSource)).toBeNull()
  expect(verifiedNoteEvidence([], assessmentSource)).toBeNull()
})
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
