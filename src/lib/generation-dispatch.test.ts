import { beforeEach, expect, it, vi } from "vitest"
import { dispatchGeneration, generationFollowups } from "./generation-dispatch"
const m = vi.hoisted(() => ({ preview: vi.fn(), read: vi.fn(), remove: vi.fn() }))
vi.mock("./tutorial-letter", () => ({ getTutorialPreview: m.preview }))
vi.mock("@/app/api/admin/papers/read/route", () => ({ POST: m.read }))
vi.mock("@vercel/blob", () => ({ del: m.remove }))
beforeEach(() => { vi.resetAllMocks(); m.remove.mockResolvedValue(undefined) })
it("expands a tutorial-letter job into all incomplete tasks on the server", async () => {
  m.preview.mockResolvedValue({ id: "draft", applied: false, tasks: [{ key: "done", complete: true }, { key: "lesson-0-1", complete: false, title: "Lesson" }, { key: "assessment-0", complete: false, title: "Assessment" }] })
  const result = await dispatchGeneration("owner", { path: "/api/admin/modules/m/tutorial-letter", body: { action: "draft-all", importId: "draft" } })
  expect(result.next.map(t => t.body.key)).toEqual(["lesson-0-1", "assessment-0"])
})
it("queues all module topics and carries generation settings and document sources", () => {
  const next = generationFollowups({ path: "/api/modules/build", body: { sources: [{ name: "paper", text: "source" }] }, continueWith: "module-topics" }, { moduleId: "mod", topics: [{ id: "t1", title: "One" }, { id: "t2", title: "Two" }] })
  expect(next).toHaveLength(2)
  expect(next[1]).toMatchObject({ path: "/api/modules/build/topic", body: { moduleId: "mod", topicId: "t2", sources: [{ name: "paper", text: "source" }] } })
})
it("queues each assignment topic once without saving unreviewed drafts", () => {
  const tasks = generationFollowups({ path: "/api/admin/modules/m/assignments", body: { action: "draft", source: {} }, continueWith: "assignment-lessons" }, { matches: [{ topicId: "a" }, { topicId: "a" }, { topicId: "b" }] })
  expect(tasks.map(t => t.body.topicId)).toEqual(["a", "b"])
  expect(tasks.every(t => t.body.action === "lesson")).toBe(true)
})
it("queues server OCR and its continuation instead of returning to the browser", async () => {
  m.read.mockResolvedValue(Response.json({ needsOcr: true, pageCount: 2 }))
  const result = await dispatchGeneration("owner", { path: "/api/admin/papers/read", body: { moduleId: "m", url: "https://test.blob.vercel-storage.com/textbooks/a.pdf" } })
  expect(result.next.map(t => t.path)).toEqual(["/api/admin/textbooks/ocr-pdf-page", "/api/admin/textbooks/ocr-pdf-page", "/api/generation/finish-ocr"])
  expect(result.next.slice(0, 2).map(t => t.body.page)).toEqual([1, 2])
})
it("reassembles every scanned page before continuing paper extraction", async () => {
  m.read.mockResolvedValue(Response.json({ questions: ["result"] }))
  const original = { path: "/api/admin/papers/read", body: { moduleId: "m", url: "https://test.blob.vercel-storage.com/textbooks/a.pdf" } }
  const result = await dispatchGeneration("owner", { path: "/api/generation/finish-ocr", body: { original, pageCount: 2, ocrKey: "key" } }, [
    { task: { path: "/api/admin/textbooks/ocr-pdf-page", body: { page: 1, ocrKey: "key" } }, data: { text: "First" } },
    { task: { path: "/api/admin/textbooks/ocr-pdf-page", body: { page: 2, ocrKey: "key" } }, data: { text: "Second" } },
  ])
  expect(result.data).toEqual({ questions: ["result"] })
  expect(await m.read.mock.calls[0][0].json()).toMatchObject({ ocr: { pages: ["First", "Second"] } })
  expect(m.remove).toHaveBeenCalledOnce()
})
