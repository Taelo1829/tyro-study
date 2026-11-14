import { beforeEach, expect, it, vi } from "vitest"
import { GET } from "./route"
const m = vi.hoisted(() => ({ modules: vi.fn(), opened: vi.fn() }))
vi.mock("@/lib/auth-session", () => ({ getAuthUserId: async () => "student" }))
vi.mock("next-auth", () => ({ getServerSession: async () => ({ user: { role: "STUDENT" } }) }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/admin", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { module: { findMany: m.modules }, $queryRaw: m.opened } }))
vi.mock("@/lib/courses", () => ({ courseIdsByModule: async () => new Map(), setModuleCourses: vi.fn() }))
vi.mock("@/lib/levels-server", () => ({ getUserLevel: async () => "tertiary", moduleLevels: async () => new Map(), setModuleLevel: vi.fn() }))
beforeEach(() => {
 vi.resetAllMocks()
 m.modules.mockResolvedValue([
  { id: "joined", title: "Joined module", enrollments: [{ id: "enrollment", enrolledAt: new Date() }] },
  { id: "available", title: "Available module", enrollments: [] },
 ])
})
it("returns joined and browse modules even before the last-opened migration", async () => {
 m.opened.mockRejectedValue(new Error('column "lastOpenedAt" does not exist'))
 const response = await GET(new Request("http://localhost/api/modules?scope=mine"))
 expect(response.status).toBe(200)
 expect(await response.json()).toMatchObject([
  { id: "joined", isEnrolled: true, lastOpenedAt: null },
  { id: "available", isEnrolled: false, lastOpenedAt: null },
 ])
})
it("includes last-opened dates when available", async () => {
 m.opened.mockResolvedValue([{ moduleId: "joined", lastOpenedAt: new Date("2026-11-14T12:00:00Z") }])
 const response = await GET(new Request("http://localhost/api/modules?scope=mine"))
 expect((await response.json())[0].lastOpenedAt).toBe("2026-11-14T12:00:00.000Z")
})
