import { beforeEach, expect, it, vi } from "vitest"
import { parseDocumentOutline, outlineDocumentModule, ASSIGNMENT_CHECKPOINT } from "./document-module"
const chat = vi.hoisted(() => vi.fn())
vi.mock("@/lib/ai/openai", () => ({ chatJson: chat }))
beforeEach(() => vi.resetAllMocks())
const sources = [{ name: "assignment.pdf", text: "Define functions and calculate their return values." }]
const outline = () => ({ description: "Functions and return values", chapters: [{ title: "Programming", topics: [{ title: "Functions", theory: true, sourceIndex: 0, evidence: "Define functions" }, { title: "Return values", theory: false, sourceIndex: 0, evidence: "calculate their return values" }], checkpointTitle: "Write a function" }] })
it("orders a cumulative assignment after all chapter prerequisites", () => {
 const result = parseDocumentOutline(outline(), sources)
 expect(result.chapters[0].topics.map(t => t.title)).toEqual(["Functions", "Return values", ASSIGNMENT_CHECKPOINT + "Write a function"])
})
it("omits invented coverage and rejects duplicate concepts or malformed plans", () => {
 const madeUp = outline(); madeUp.chapters[0].topics[0].evidence = "not in the document"
 expect(parseDocumentOutline(madeUp, sources).chapters[0].topics.map(t => t.title)).toEqual(["Return values", ASSIGNMENT_CHECKPOINT + "Return values"])
 const repeated = outline(); repeated.chapters[0].topics[1].title = "Functions"
 expect(() => parseDocumentOutline(repeated, sources)).toThrow("repeated")
 expect(() => parseDocumentOutline({ chapters: [] }, sources)).toThrow()
})
it("uses actual supplied material when planning a module", async () => {
 chat.mockResolvedValue(outline())
 const result = await outlineDocumentModule("Programming", "First year", sources)
 expect(JSON.parse(chat.mock.calls[0][0].user).sources).toEqual(sources.map((s, sourceIndex) => ({ ...s, sourceIndex })))
 expect(result.chapters[0].topics).toHaveLength(3)
})

it("tolerates PDF wrapping, typography and a misnumbered source", () => {
 const plan = outline()
 plan.chapters[0].topics[0].sourceIndex = 1
 plan.chapters[0].topics[0].evidence = "Define functions"
 const docs = [{ name: "a.pdf", text: "DEFINE func-\ntions and calculate their return values." }]
 expect(parseDocumentOutline(plan, docs).chapters).toHaveLength(1)
})
it("finds a real quote in another supplied document", () => {
 const plan = outline()
 expect(parseDocumentOutline(plan, [{ name: "unrelated", text: "Other text" }, ...sources]).chapters).toHaveLength(1)
})
it("omits unsupported topics without retrying to fit them into the module", async () => {
 const bad = outline(); bad.chapters[0].topics[0].title = "Fundamentals of OOP"; bad.chapters[0].topics[0].evidence = "A paraphrase not in the source"
 chat.mockResolvedValue(bad)
 const result = await outlineDocumentModule("Programming", "", sources)
 expect(JSON.stringify(result)).not.toContain("Fundamentals of OOP")
 expect(result.chapters[0].topics[0].title).toBe("Return values")
 expect(chat).toHaveBeenCalledTimes(1)
})
it("does not create an empty module or regenerate unsupported topics", async () => {
 const bad = outline(); bad.chapters[0].topics.forEach(t => { t.evidence = "Invented unsupported subject" })
 chat.mockResolvedValue(bad)
 await expect(outlineDocumentModule("Programming", "", sources)).rejects.toThrow("No supported topics")
 expect(chat).toHaveBeenCalledTimes(1)
})
it("removes empty chapters and their assignment checkpoints", () => {
 const plan = outline()
 plan.chapters.push({ title: "OOP", topics: [{ title: "Fundamentals of OOP", theory: true, sourceIndex: 0, evidence: "Unsupported OOP content" }], checkpointTitle: "OOP exercise" })
 const result = parseDocumentOutline(plan, sources)
 expect(result.chapters).toHaveLength(1)
 expect(JSON.stringify(result)).not.toContain("OOP")
})
it("does not erase numeric or mathematical differences in evidence", () => {
 const plan = outline(); plan.chapters[0].topics[0].evidence = "Calculate x + 2"
 expect(parseDocumentOutline(plan, [{ name: "a", text: "Calculate x − 2 and calculate their return values" }]).chapters[0].topics[0].title).toBe("Return values")
})
