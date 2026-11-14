import { beforeEach, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"
import { POST } from "./route"

const m = vi.hoisted(() => ({ auth: vi.fn(), update: vi.fn() }))
vi.mock("@/lib/auth-session", () => ({ requireAuth: m.auth }))
vi.mock("@/lib/prisma", () => ({ prisma: { $executeRaw: m.update } }))
const ctx = { params: Promise.resolve({ id: "module-a" }) }
const request = () => new Request("http://localhost/api/modules/module-a/opened", { method: "POST" })
beforeEach(() => {
  vi.resetAllMocks()
  m.auth.mockResolvedValue({ userId: "student-a", error: null })
  m.update.mockResolvedValue(1)
})
it("records the visit only on the signed-in user's enrollment", async () => {
  expect(await (await POST(request(), ctx)).json()).toEqual({ recorded: true })
  expect(m.update).toHaveBeenCalledWith(expect.any(Array), "student-a", "module-a")
  expect(m.update.mock.calls[0][0].join("?")).toContain('WHERE "userId" = ? AND "moduleId" = ?')
})
it("does not create an enrollment when the module has not been joined", async () => {
  m.update.mockResolvedValue(0)
  expect(await (await POST(request(), ctx)).json()).toEqual({ recorded: false })
})
it("rejects signed-out requests before writing", async () => {
  m.auth.mockResolvedValue({ error: NextResponse.json({}, { status: 401 }) })
  expect((await POST(request(), ctx)).status).toBe(401)
  expect(m.update).not.toHaveBeenCalled()
})
