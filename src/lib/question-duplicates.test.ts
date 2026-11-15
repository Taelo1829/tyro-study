import { beforeEach, expect, it, vi } from "vitest"
import { checkQuestionAdditions, questionDuplicates } from "./question-duplicates"

const m = vi.hoisted(() => ({ chat: vi.fn(), find: vi.fn() }))
vi.mock("@/lib/ai/openai", () => ({ chatJson: m.chat }))
vi.mock("@/lib/prisma", () => ({ prisma: { question: { findMany: m.find } } }))
const q = (question: string) => ({ question, options: ["CPU", "RAM"], correctOption: "CPU" })
beforeEach(() => {
  vi.resetAllMocks()
  m.chat.mockResolvedValue({ duplicates: [] })
  m.find.mockResolvedValue([])
})
it("detects exact duplicates with whitespace changes and reordered options without AI", async () => {
  const original = q("Which component executes instructions?")
  const matches = await questionDuplicates([{ ...original, question: " Which component  executes instructions? ", options: ["RAM", "CPU"] }], [original])
  expect(matches.get(0)).toEqual(original)
  expect(m.chat).not.toHaveBeenCalled()
})
it("uses semantic matches for differently worded questions", async () => {
  const original = q("Which component executes instructions?")
  m.chat.mockResolvedValue({ duplicates: [{ candidate: 1, reference: 0 }] })
  expect((await questionDuplicates([q("What hardware carries out program commands?")], [original])).get(0)).toEqual(original)
  expect(JSON.parse(m.chat.mock.calls[0][0].user).references[0].correctOption).toBe("CPU")
})
it("checks duplicates within a batch and resolves chains to the original", async () => {
  const original = q("Which component executes instructions?")
  m.chat.mockResolvedValue({ duplicates: [{ candidate: 1, reference: 0 }] })
  const reworded = q("What hardware carries out program commands?")
  const matches = await questionDuplicates([original, reworded, reworded], [])
  expect(matches.size).toBe(2)
  expect(matches.get(1)).toEqual(original)
  expect(matches.get(2)).toEqual(original)
})
it("does not collapse different mathematical operators or negation in exact matching", async () => {
  const incoming = [q("Solve x > 0"), q("Which is NOT a processor?")]
  expect((await questionDuplicates(incoming, [q("Solve x < 0"), q("Which is a processor?")])).size).toBe(0)
  expect(m.chat).toHaveBeenCalled()
})
it("checks beyond the first reference chunk", async () => {
  const existing = Array.from({ length: 81 }, (_, i) => q(`Existing ${i}`))
  m.chat.mockImplementation(async ({ user }: { user: string }) => {
    const { references } = JSON.parse(user)
    return { duplicates: references.some((r: { id: number }) => r.id === 80) ? [{ candidate: 81, reference: 80 }] : [] }
  })
  expect((await questionDuplicates([q("Reworded last question")], existing)).get(0)).toEqual(existing[80])
  expect(m.chat).toHaveBeenCalledTimes(3)
})
it("rejects invalid or forward references rather than dropping unrelated questions", async () => {
  m.chat.mockResolvedValue({ duplicates: [{ candidate: 0, reference: 1 }] })
  await expect(questionDuplicates([q("First"), q("Second")], [])).rejects.toThrow("Invalid duplicate")
})
it("propagates a failed semantic check", async () => {
  m.chat.mockRejectedValue(new Error("Unavailable"))
  await expect(questionDuplicates([q("New")], [q("Existing")])).rejects.toThrow("Unavailable")
})
it("scopes chapter checks to dedicated chapter questions and topic checks to their topic", async () => {
  await checkQuestionAdditions({ chapterId: "chapter" }, [q("New")])
  expect(m.find).toHaveBeenLastCalledWith(expect.objectContaining({ where: { chapterId: "chapter", topicId: null } }))
  await checkQuestionAdditions({ topicId: "topic" }, [q("New")])
  expect(m.find).toHaveBeenLastCalledWith(expect.objectContaining({ where: { topicId: "topic" } }))
})
