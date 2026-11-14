import { beforeEach, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"
import { POST } from "./route"
const m = vi.hoisted(() => ({ auth: vi.fn(), chapters: vi.fn(), draft: vi.fn(), save: vi.fn(), lesson: vi.fn() }))
vi.mock("@/lib/admin", () => ({ requireAdmin: m.auth }))
vi.mock("@/lib/prisma", () => ({ prisma: { chapter: { findMany: m.chapters } } }))
vi.mock("@/lib/uploaded-assignment", () => ({ draftUploadedAssignment: m.draft, saveUploadedAssignment: m.save, draftAssignmentLesson: m.lesson }))
vi.mock("@/lib/monitoring", () => ({ captureError: vi.fn() }))
const source = { name: "a.pdf", text: "Write a function. Repeat its calculation using a loop." }
const request = (body: unknown) => new Request("http://localhost", { method: "POST", body: JSON.stringify(body) })
const ctx = { params: Promise.resolve({ id: "mod" }) }
beforeEach(() => { vi.resetAllMocks(); m.auth.mockResolvedValue({ error: null }); m.chapters.mockResolvedValue([{ id: "ch" }]); m.draft.mockResolvedValue({ title: "A" }) })
it("allows only admins to draft or save assignments", async () => {
 m.auth.mockResolvedValue({ error: NextResponse.json({}, { status: 403 }) })
 expect((await POST(request({ action: "draft", source }), ctx)).status).toBe(403)
 expect((await POST(request({ action: "save", source }), ctx)).status).toBe(403)
 expect(m.draft).not.toHaveBeenCalled(); expect(m.save).not.toHaveBeenCalled()
})
it("scopes topic matching to the selected module and does not save a draft", async () => {
 expect((await POST(request({ action: "draft", source }), ctx)).status).toBe(200)
 expect(m.chapters.mock.calls[0][0].where).toEqual({ moduleId: "mod" })
 expect(m.save).not.toHaveBeenCalled()
})
it("rejects empty or excessively large assignments", async () => {
 expect((await POST(request({ action: "draft", source: { ...source, text: "" } }), ctx)).status).toBe(400)
 expect((await POST(request({ action: "draft", source: { ...source, text: "a".repeat(40001) } }), ctx)).status).toBe(400)
 expect(m.draft).not.toHaveBeenCalled()
})


it("requires lesson updates when saving an assignment", async () => {
 expect((await POST(request({ action: "save", title: "Assignment", source, matches: [], questions: [] }), ctx)).status).toBe(400)
 expect(m.save).not.toHaveBeenCalled()
})
it("drafts a targeted lesson without saving any content", async () => {
 m.lesson.mockResolvedValue({ topicId: "t1", html: "<p>Draft</p>" })
 const matches = [{ topicId: "t1", evidence: "Write a function" }]
 expect((await POST(request({ action: "lesson", source, matches, topicId: "t1" }), ctx)).status).toBe(200)
 expect(m.lesson).toHaveBeenCalledWith("mod", source, matches, "t1")
 expect(m.save).not.toHaveBeenCalled()
})
