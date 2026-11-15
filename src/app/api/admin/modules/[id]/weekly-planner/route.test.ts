import { beforeEach, expect, it, vi } from "vitest"
import { GET, PATCH } from "./route"
const m = vi.hoisted(() => ({ admin: vi.fn(), execute: vi.fn(), enabled: vi.fn() }))
vi.mock("@/lib/admin", () => ({ requireAdmin: m.admin }))
vi.mock("@/lib/prisma", () => ({ prisma: { $executeRaw: m.execute } }))
vi.mock("@/lib/weekly-planner-settings", () => ({ weeklyPlannerEnabled: m.enabled }))
const context = { params: Promise.resolve({ id: "module-a" }) }
const patch = (enabled: unknown) => PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ enabled }) }), context)
beforeEach(() => { vi.resetAllMocks(); m.admin.mockResolvedValue({ error: null }); m.enabled.mockResolvedValue(false); m.execute.mockResolvedValue(1) })
it("requires admin access for reading and changing the switch", async () => {
  m.admin.mockResolvedValue({ error: new Response(null, { status: 403 }) })
  expect((await GET(new Request("http://localhost"), context)).status).toBe(403)
  expect((await patch(true)).status).toBe(403)
  expect(m.execute).not.toHaveBeenCalled()
})
it("returns off and saves the chosen boolean only for the target module", async () => {
  expect(await (await GET(new Request("http://localhost"), context)).json()).toEqual({ enabled: false })
  expect(await (await patch(true)).json()).toEqual({ enabled: true })
  expect(m.execute.mock.calls[0].slice(1)).toEqual([true, "module-a"])
  expect(await (await patch(false)).json()).toEqual({ enabled: false })
})
it("rejects nonboolean settings and missing modules", async () => {
  expect((await patch("false")).status).toBe(400)
  expect(m.execute).not.toHaveBeenCalled()
  m.execute.mockResolvedValue(0)
  expect((await patch(false)).status).toBe(404)
})
