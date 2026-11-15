import { beforeEach, expect, it, vi } from "vitest"
import { GET } from "./route"
const m = vi.hoisted(() => ({ user: vi.fn(), enabled: vi.fn(), guide: vi.fn() }))
vi.mock("@/lib/auth-session", () => ({ getAuthUserId: m.user }))
vi.mock("@/lib/weekly-planner-settings", () => ({ weeklyPlannerEnabled: m.enabled }))
vi.mock("@/lib/tutorial-letter", () => ({ getTutorialGuide: m.guide }))
const get = () => GET(new Request("http://localhost"), { params: Promise.resolve({ id: "module" }) })
beforeEach(() => { vi.resetAllMocks(); m.user.mockResolvedValue("student"); m.enabled.mockResolvedValue(false) })
it("hides the study guide when the shared switch is off", async () => {
  expect(await (await get()).json()).toBeNull()
  expect(m.guide).not.toHaveBeenCalled()
})
it("returns the study guide when the same switch is enabled", async () => {
  m.enabled.mockResolvedValue(true); m.guide.mockResolvedValue({ sourceName: "Letter.pdf" })
  expect(await (await get()).json()).toEqual({ sourceName: "Letter.pdf" })
  expect(m.enabled).toHaveBeenCalledWith("module")
  expect(m.guide).toHaveBeenCalledWith("module")
})
it("requires sign-in before reading the setting or guide", async () => {
  m.user.mockResolvedValue(null)
  expect((await get()).status).toBe(401)
  expect(m.enabled).not.toHaveBeenCalled()
})
