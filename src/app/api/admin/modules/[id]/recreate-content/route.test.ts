import { beforeEach, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"
import { GET, POST } from "./route"
const mocks = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), draft: vi.fn(), save: vi.fn(), topics: vi.fn() }))
vi.mock("@/lib/admin", () => ({ requireAdmin: mocks.auth }))
vi.mock("@/lib/prisma", () => ({ prisma: { topic: { findMany: mocks.topics }, module: { findUnique: mocks.find } } }))
vi.mock("@/lib/module-recreation", () => ({ draftModuleLesson: mocks.draft, saveModuleLessons: mocks.save }))
vi.mock("@/lib/monitoring", () => ({ captureError: vi.fn() }))
const context = { params: Promise.resolve({ id: "module" }) }
const req = (body: unknown) => new Request("http://localhost/api/admin/modules/module/recreate-content", { method: "POST", body: JSON.stringify(body) })
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ error: null }); mocks.topics.mockResolvedValue([{ id: "topic", title: "Functions", chapter: { title: "Programming" } }]) })

it("refuses both reads and writes for non-admin users", async () => {
  mocks.auth.mockResolvedValue({ error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) })
  expect((await GET(req({}), context)).status).toBe(403)
  expect((await POST(req({ action: "save" }), context)).status).toBe(403)
  expect(mocks.find).not.toHaveBeenCalled()
  expect(mocks.draft).not.toHaveBeenCalled()
  expect(mocks.save).not.toHaveBeenCalled()
})
it("rejects empty or malformed source material before generation", async () => {
  expect((await POST(req({ action: "draft", topicId: "topic", sources: [] }), context)).status).toBe(400)
  expect(mocks.draft).not.toHaveBeenCalled()
})
it("scopes generation to the module in the URL without saving", async () => {
  const sources = [{ name: "paper.pdf", text: "Questions testing functions and their return values." }]
  mocks.draft.mockResolvedValue({ skipped: true, topicId: "topic" })
  expect((await POST(req({ action: "draft", topicId: "topic", sources, assignmentAnalysis: { assignments: [], unresolved: [0] } }), context)).status).toBe(200)
  expect(mocks.draft).toHaveBeenCalledWith("module", "topic", sources, null, [0])
  expect(mocks.save).not.toHaveBeenCalled()
})
