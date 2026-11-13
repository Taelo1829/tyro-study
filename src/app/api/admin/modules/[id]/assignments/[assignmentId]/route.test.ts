import { beforeEach, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"
import { DELETE } from "./route"
const m = vi.hoisted(() => ({ auth: vi.fn(), remove: vi.fn() }))
vi.mock("@/lib/admin", () => ({ requireAdmin: m.auth }))
vi.mock("@/lib/delete-uploaded-assignment", () => ({ deleteUploadedAssignment: m.remove }))
vi.mock("@/lib/monitoring", () => ({ captureError: vi.fn() }))
const ctx = { params: Promise.resolve({ id: "module", assignmentId: "assignment" }) }
const req = new Request("http://localhost", { method: "DELETE" })
beforeEach(() => { vi.resetAllMocks(); m.auth.mockResolvedValue({ error: null }); m.remove.mockResolvedValue(true) })
it("requires admin access before deleting", async () => {
 m.auth.mockResolvedValue({ error: NextResponse.json({}, { status: 403 }) })
 expect((await DELETE(req, ctx)).status).toBe(403)
 expect(m.remove).not.toHaveBeenCalled()
})
it("deletes only the assignment and module in the URL", async () => {
 expect((await DELETE(req, ctx)).status).toBe(200)
 expect(m.remove).toHaveBeenCalledWith("module", "assignment")
})
it("does not claim success when the uploaded assignment is missing", async () => {
 m.remove.mockResolvedValue(false)
 expect((await DELETE(req, ctx)).status).toBe(404)
})
