import { beforeEach, expect, it, vi } from "vitest"
import { createHash } from "node:crypto"
import { GET, POST } from "./route"
const m = vi.hoisted(() => ({ auth: vi.fn(), enrolled: vi.fn(), query: vi.fn(), txQuery: vi.fn(), execute: vi.fn(), transaction: vi.fn(), guide: vi.fn(), enabled: vi.fn() }))
vi.mock("@/lib/auth-session", () => ({ requireAuth: m.auth }))
vi.mock("@/lib/prisma", () => ({ prisma: { moduleEnrollment: { findUnique: m.enrolled }, $queryRaw: m.query, $transaction: m.transaction } }))
vi.mock("@/lib/tutorial-letter", () => ({ getTutorialGuide: m.guide }))
vi.mock("@/lib/weekly-planner-settings", () => ({ weeklyPlannerEnabled: m.enabled }))
const context = { params: Promise.resolve({ id: "mod" }) }
const prefix = `weekly-${createHash("sha256").update(JSON.stringify(["user", "mod"])).digest("hex").slice(0, 32)}-`
const post = (body: object) => POST(new Request("http://localhost/api/modules/mod/weekly-plan", { method: "POST", body: JSON.stringify(body) }), context)
beforeEach(() => {
  vi.resetAllMocks()
  m.enabled.mockResolvedValue(true)
  m.auth.mockResolvedValue({ userId: "user", error: null })
  m.enrolled.mockResolvedValue({ id: "enrollment" })
  m.query.mockResolvedValue([]); m.txQuery.mockResolvedValue([])
  m.transaction.mockImplementation(fn => fn({ $queryRaw: m.txQuery, $executeRaw: m.execute }))
  m.guide.mockResolvedValue({ sourceName: "2022 letter", year: "2022", moduleCode: "COS2621", studyPlan: [{ period: "Week 1-2", reading: "Read chapter 1", evidence: "" }] })
})
it("requires authentication and enrollment", async () => {
  m.auth.mockResolvedValueOnce({ error: new Response(null, { status: 401 }) })
  expect((await GET(new Request("http://localhost"), context)).status).toBe(401)
  m.enrolled.mockResolvedValue(null)
  expect((await post({ action: "create" })).status).toBe(403)
  expect(m.transaction).not.toHaveBeenCalled()
})
it("creates only the signed-in user's weekly calendar entries", async () => {
  expect((await post({ action: "create", startDate: "2027-01-04", reminders: true, userId: "someone-else" })).status).toBe(200)
  expect(m.execute).toHaveBeenCalledTimes(2)
  expect(m.execute.mock.calls[0]).toContain("user")
  expect(m.execute.mock.calls[0]).not.toContain("someone-else")
  expect(m.execute.mock.calls[0]).toContain("2027-01-04T07:00:00.000Z")
})
it("does not duplicate an existing plan on a repeated create request", async () => {
  m.txQuery.mockResolvedValueOnce([{ id: "enrollment" }]).mockResolvedValueOnce([{ id: prefix + "001", completed: false }])
  expect((await post({ action: "create", startDate: "2027-01-04", reminders: false })).status).toBe(200)
  expect(m.execute).not.toHaveBeenCalled()
})
it("reschedules only unfinished tasks and keeps completed goals", async () => {
  m.txQuery.mockResolvedValueOnce([{ id: "enrollment" }]).mockResolvedValueOnce([{ id: prefix + "001", completed: true }, { id: prefix + "002", completed: false }])
  expect((await post({ action: "reschedule", startDate: "2027-02-01", reminders: false })).status).toBe(200)
  expect(m.execute).toHaveBeenCalledOnce()
  expect(m.execute.mock.calls[0]).toContain(prefix + "002")
  expect(m.execute.mock.calls[0]).not.toContain(prefix + "001")
  expect(m.execute.mock.calls[0]).toContain("2027-02-01T07:00:00.000Z")
})
it("rejects cross-user task IDs and malformed dates", async () => {
  expect((await post({ action: "complete", taskId: "someone-elses-task", completed: true })).status).toBe(400)
  expect((await post({ action: "create", startDate: "2027-02-30", reminders: false })).status).toBe(400)
  expect(m.transaction).not.toHaveBeenCalled()
})
it("hides saved tasks when the module planner is off", async () => {
  m.enabled.mockResolvedValue(false)
  const response = await GET(new Request("http://localhost"), context)
  expect(await response.json()).toEqual({ enabled: false, tasks: [] })
  expect(m.query).not.toHaveBeenCalled()
})
it("blocks creation, rescheduling and completion while disabled", async () => {
  m.enabled.mockResolvedValue(false)
  for (const action of ["create", "reschedule", "complete"]) {
    expect((await post({ action, startDate: "2027-01-04", reminders: false, taskId: prefix + "001", completed: true })).status).toBe(403)
  }
  expect(m.transaction).not.toHaveBeenCalled()
})
