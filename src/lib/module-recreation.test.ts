import { beforeEach, describe, expect, it, vi } from "vitest"
import { draftModuleLesson, lessonVersion, saveModuleLessons } from "./module-recreation"
import { parsePaperSources, parseReplacements, MAX_SOURCE_CHARS } from "./module-recreation-input"
import { sanitizeTopicContentServer } from "./topic-content-server"

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), find: vi.fn(), update: vi.fn(), draftFind: vi.fn(), chat: vi.fn(), write: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: {
  topic: { findFirst: mocks.draftFind },
  $transaction: mocks.transaction,
} }))
vi.mock("@/lib/ai/openai", () => ({ chatJson: mocks.chat }))
vi.mock("@/lib/ai/writers", () => ({ writeLessonHtml: mocks.write, LENGTH_GUIDE: { standard: "900 words" } }))

const topic = { id: "topic", title: "Functions", chapterId: "chapter", content: "<p>Original lesson.</p>" }
const replacement = () => ({ topicId: topic.id, version: lessonVersion(topic), html: "<p>New lesson.</p>" })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({ topic: { findFirst: mocks.find, updateMany: mocks.update } }))
  mocks.find.mockResolvedValue(topic)
  mocks.update.mockResolvedValue({ count: 1 })
})

describe("paper-based recreation", () => {
  it("validates every file and rejects oversized batches without truncating", () => {
    expect(parsePaperSources([{ name: "exam.pdf", text: "A useful question about functions and return values." }])).toHaveLength(1)
    expect(() => parsePaperSources([])).toThrow()
    expect(() => parsePaperSources([{ name: "blank.pdf", text: "" }])).toThrow()
    expect(() => parsePaperSources([{ name: "huge.pdf", text: "a".repeat(MAX_SOURCE_CHARS + 1) }])).toThrow("too much")
  })
  it("rejects duplicate topic replacements and invalid versions", () => {
    expect(() => parseReplacements([replacement(), replacement()])).toThrow("more than once")
    expect(() => parseReplacements([{ ...replacement(), version: "stale" }])).toThrow("invalid")
  })
  it("changes lesson content only, preserving identity, structure and other fields", async () => {
    expect(await saveModuleLessons("module", [replacement()])).toBe(1)
    expect(mocks.find).toHaveBeenCalledWith({ where: { id: "topic", chapter: { moduleId: "module" } } })
    expect(mocks.update).toHaveBeenCalledWith({ where: topic, data: { content: "<p>New lesson.</p>" } })
  })
  it("rejects topics outside the module", async () => {
    mocks.find.mockResolvedValue(null)
    await expect(saveModuleLessons("module", [replacement()])).rejects.toThrow("no longer")
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it("rejects stale drafts and changes made while saving", async () => {
    mocks.find.mockResolvedValue({ ...topic, content: "Someone else's edit" })
    await expect(saveModuleLessons("module", [replacement()])).rejects.toThrow("changed after drafting")
    expect(mocks.update).not.toHaveBeenCalled()
    mocks.find.mockResolvedValue(topic)
    mocks.update.mockResolvedValue({ count: 0 })
    await expect(saveModuleLessons("module", [replacement()])).rejects.toThrow("changed while saving")
  })
  it("treats retrying an already-saved draft as successful", async () => {
    mocks.find.mockResolvedValue({ ...topic, content: replacement().html })
    expect(await saveModuleLessons("module", [replacement()])).toBe(1)
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it("sanitizes scripts while retaining graph markers for later rendering", async () => {
    const html = '<p onclick="evil()">A function.</p><script>evil()</script><div class="graph" data-fn="x^2">Parabola</div>'
    const cleaned = sanitizeTopicContentServer(html)
    expect(cleaned).not.toContain("evil")
    expect(cleaned).toContain('data-fn="x^2"')
    await saveModuleLessons("module", [{ ...replacement(), html }])
    expect(mocks.update.mock.calls[0][0].data.content).toBe(cleaned)
  })
  it("leaves topics uncovered by papers unchanged", async () => {
    mocks.draftFind.mockResolvedValue({ ...topic, chapter: { title: "Programming", module: { title: "COS1511", description: null, chapters: [{ title: "Programming", topics: [{ id: topic.id, title: topic.title }] }] } } })
    mocks.chat.mockResolvedValue({ relevant: false })
    expect(await draftModuleLesson("module", "topic", [{ name: "paper.pdf", text: "Unrelated questions" }])).toMatchObject({ skipped: true })
    expect(mocks.write).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })
})

it("keeps a lesson draft when quiz generation fails", async () => {
 mocks.draftFind.mockResolvedValue({ ...topic, chapter: { title: "Programming", module: { title: "COS1511", description: null, chapters: [{ title: "Programming", topics: [{ id: topic.id, title: topic.title }] }] } } })
 mocks.chat.mockResolvedValueOnce({ relevant: true, sourceIndices: [0] }).mockRejectedValueOnce(new Error("Quiz failed"))
 mocks.write.mockResolvedValue("<p>A complete lesson.</p>")
 const draft = await draftModuleLesson("module", "topic", [{ name: "assignment.pdf", text: "Upload a PDF document answering these questions." }], null, [0])
 expect(draft).toMatchObject({ skipped: false, html: "<p>A complete lesson.</p>", quizUnchanged: true })
 expect(draft).not.toHaveProperty("questions", expect.any(Array))
 expect(mocks.chat).toHaveBeenCalledTimes(2)
})
it("creates lessons alone when fallback format is uncertain", async () => {
 mocks.draftFind.mockResolvedValue({ ...topic, chapter: { title: "Programming", module: { title: "COS1511", description: null, chapters: [{ title: "Programming", topics: [{ id: topic.id, title: topic.title }] }] } } })
 mocks.chat.mockResolvedValue({ relevant: true, sourceIndices: [0] })
 mocks.write.mockResolvedValue("<p>A complete lesson.</p>")
 expect(await draftModuleLesson("module", "topic", [{ name: "a", text: "Discuss functions." }], null, [0])).toMatchObject({ skipped: false, quizUnchanged: true })
 expect(mocks.chat).toHaveBeenCalledTimes(1)
})

it("allows time to acquire a transaction and retries an acquisition timeout once", async () => {
 mocks.transaction.mockRejectedValueOnce(Object.assign(new Error("Transaction API error: Unable to start a transaction in the given time."), { code: "P2028" }))
 expect(await saveModuleLessons("module", [replacement()])).toBe(1)
 expect(mocks.transaction).toHaveBeenCalledTimes(2)
 expect(mocks.transaction.mock.calls[0][1]).toEqual({ maxWait: 20000, timeout: 120000 })
 expect(mocks.update).toHaveBeenCalledTimes(1)
})
it("stops after one retry and does not replay an expired in-flight transaction", async () => {
 const busy = Object.assign(new Error("Unable to start a transaction in the given time."), { code: "P2028" })
 mocks.transaction.mockRejectedValue(busy)
 await expect(saveModuleLessons("module", [replacement()])).rejects.toBe(busy)
 expect(mocks.transaction).toHaveBeenCalledTimes(2)
 mocks.transaction.mockClear()
 const expired = Object.assign(new Error("Transaction already closed: expired transaction"), { code: "P2028" })
 mocks.transaction.mockRejectedValue(expired)
 await expect(saveModuleLessons("module", [replacement()])).rejects.toBe(expired)
 expect(mocks.transaction).toHaveBeenCalledTimes(1)
})

it("creates a checkpoint as one written assignment even when source quizzes are MCQ", async () => {
 const title = "Assignment checkpoint: Functions"
 mocks.draftFind.mockResolvedValue({ ...topic, title, chapter: { title: "Programming", module: { title: "COS1511", description: null, chapters: [{ title: "Programming", topics: [{ id: "prior", title: "Functions" }, { id: topic.id, title }] }] } } })
 mocks.chat.mockResolvedValueOnce({ relevant: true }).mockResolvedValueOnce({ questions: [{ kind: "written", question: "Write and explain a function. Show all your working.", difficulty: "medium", marks: 20, rubric: [{ criterion: "Function and explanation", marks: 20 }], modelAnswer: "PRIVATE MODEL SOLUTION" }] })
 const result = await draftModuleLesson("module", topic.id, [{ name: "a", text: "Questions about functions" }], { kinds: ["mcq"], sources: ["a"] })
 expect(result).toMatchObject({ skipped: false, questions: [{ kind: "written", marks: 20 }], quizUnchanged: false })
 if (result.skipped) throw new Error("Unexpected skip")
 expect(result.questions).toHaveLength(1)
 expect(result.html).toContain("Assignment brief")
 expect(result.html).not.toContain("PRIVATE MODEL SOLUTION")
 expect(mocks.write).not.toHaveBeenCalled()
})
