import { beforeEach, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"
import { POST } from "./route"
const m = vi.hoisted(() => ({ auth: vi.fn(), topic: vi.fn(), analyse: vi.fn(), draft: vi.fn(), save: vi.fn() }))
vi.mock("@/lib/admin", () => ({ requireAdmin: m.auth }))
vi.mock("@/lib/prisma", () => ({ prisma: { topic: { findFirst: m.topic } } }))
vi.mock("@/lib/assignment-quiz-format", () => ({ analyseAssignments: m.analyse }))
vi.mock("@/lib/module-recreation", () => ({ draftModuleLesson: m.draft, saveModuleLessons: m.save }))
vi.mock("@/lib/monitoring", () => ({ captureError: vi.fn() }))
const req = () => new Request("http://localhost/api/modules/build/topic", { method: "POST", body: JSON.stringify({ moduleId: "m", topicId: "t", sources: [{ name: "a.pdf", text: "Submit a PDF document showing functions and return values." }] }) })
beforeEach(() => {
 vi.resetAllMocks()
 m.auth.mockResolvedValue({ error: null })
 m.topic.mockResolvedValue({ id: "t", title: "Assignment checkpoint: Functions", order: 1, content: null, chapter: { title: "Programming", topics: [{ title: "Functions", order: 0 }, { title: "Later topic", order: 2 }] } })
 m.analyse.mockResolvedValue({ analysis: { assignments: [], unresolved: [0] }, plans: {} })
 m.draft.mockResolvedValue({ topicId: "t", skipped: false, html: "<p>Brief</p>", quizUnchanged: true, quizNote: "Lesson only" })
})
it("requires admin access", async () => {
 m.auth.mockResolvedValue({ error: NextResponse.json({}, { status: 403 }) })
 expect((await POST(req())).status).toBe(403)
 expect(m.topic).not.toHaveBeenCalled()
})
it("only uses preceding chapter topics for the checkpoint", async () => {
 expect((await POST(req())).status).toBe(200)
 expect(m.topic.mock.calls[0][0].where).toEqual({ id: "t", chapter: { moduleId: "m" } })
 expect(m.analyse.mock.calls[0][1][0].title).toBe("Functions")
 expect(m.draft.mock.calls[0][5]).not.toContain("Later topic")
 expect(m.save).toHaveBeenCalledOnce()
})
it("keeps existing content on retry", async () => {
 m.topic.mockResolvedValue({ content: "<p>Already saved</p>" })
 expect((await POST(req())).status).toBe(200)
 expect(m.draft).not.toHaveBeenCalled()
 expect(m.save).not.toHaveBeenCalled()
})
it("does not generate outside the selected module", async () => {
 m.topic.mockResolvedValue(null)
 expect((await POST(req())).status).toBe(404)
 expect(m.draft).not.toHaveBeenCalled()
})

it("reports exhausted transaction acquisition as a retryable save failure", async () => {
 m.save.mockRejectedValue(Object.assign(new Error("Unable to start a transaction in the given time."), { code: "P2028" }))
 const response = await POST(req())
 expect(response.status).toBe(503)
 expect((await response.json()).error).toContain("database is busy")
})
