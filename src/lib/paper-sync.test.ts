import { beforeEach, expect, it, vi } from "vitest"
import { POST } from "@/app/api/admin/modules/[id]/sync-papers/route"
import { generationReviewAction } from "./generation-review"
import type { GenerationJob } from "./generation-types"
const m = vi.hoisted(() => ({ admin: vi.fn(), module: vi.fn(), topics: vi.fn(), enqueue: vi.fn(), jobs: vi.fn(), save: vi.fn(), after: vi.fn() }))
vi.mock("next/server", () => ({ NextResponse: { json: (data: unknown, init?: ResponseInit) => Response.json(data, init) }, after: m.after }))
vi.mock("@/lib/admin", () => ({ requireAdmin: m.admin }))
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: m.module, topic: { findMany: m.topics } } }))
vi.mock("@/lib/generation-jobs", () => ({ enqueueGeneration: m.enqueue, generationJobs: m.jobs, runGenerationStep: vi.fn() }))
vi.mock("@/lib/module-recreation", () => ({ saveModuleLessons: m.save }))
const question = (id: string, paper = "Exam 2025") => ({ id, paper, question: "What does cache memory store?", kind: "mcq", modelAnswer: null, answers: [{ answer: "Recent data", isCorrect: true }] })
const call = (body: unknown) => POST(new Request("http://localhost/api/admin/modules/m/sync-papers", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id: "m" }) })
beforeEach(() => {
  vi.resetAllMocks()
  m.admin.mockResolvedValue({ user: { id: "admin" } })
  m.module.mockResolvedValue([{ title: "Computing", assessmentConfig: JSON.stringify({ retiredQuestionIds: ["retired"] }) }])
  m.enqueue.mockResolvedValue({ id: "job" })
})
it("groups saved papers by lesson and excludes retired questions and assignment checkpoints", async () => {
  m.topics.mockResolvedValue([{ id: "t", title: "Memory", questions: [question("a"), question("b", "Exam 2026"), question("retired")] }, { id: "assignment-a", title: "Assignment quiz: 1", questions: [question("c")] }])
  expect((await call({ action: "start" })).status).toBe(202)
  const tasks = m.enqueue.mock.calls[0][2]
  expect(tasks).toHaveLength(1)
  expect(tasks[0].body.questions.map((q: { paper: string }) => q.paper)).toEqual(["Exam 2025", "Exam 2026"])
  expect(tasks[0].options.syncExistingPapers).toBe(true)
  expect(m.save).not.toHaveBeenCalled()
})
it("reports when no uploaded paper questions are available", async () => {
  m.topics.mockResolvedValue([])
  expect((await call({ action: "start" })).status).toBe(400)
  expect(m.enqueue).not.toHaveBeenCalled()
})
it("rejects a job from another module before applying lessons", async () => {
  m.jobs.mockResolvedValue([{ status: "COMPLETED", results: [{ task: { path: "/api/admin/papers/lesson", body: { moduleId: "other" }, options: { syncExistingPapers: true } } }] }])
  expect((await call({ action: "save", jobId: "job" })).status).toBe(400)
  expect(m.jobs).toHaveBeenCalledWith("admin", "job")
  expect(m.save).not.toHaveBeenCalled()
})
it("applies persisted reviewed drafts using the existing version-checked lesson saver", async () => {
  const draft = { topicId: "t", version: "a".repeat(64), html: "<p>Updated memory lesson</p>" }
  m.jobs.mockResolvedValue([{ status: "COMPLETED", results: [{ task: { path: "/api/admin/papers/lesson", body: { moduleId: "m" }, options: { syncExistingPapers: true } }, data: draft }] }])
  m.topics.mockResolvedValue([{ id: "t", title: "Memory" }])
  m.save.mockResolvedValue(1)
  expect(await (await call({ action: "save", jobId: "job", lessons: [] })).json()).toEqual({ lessonsUpdated: 1 })
  expect(m.save).toHaveBeenCalledWith("m", [expect.objectContaining(draft)])
})
it("offers lesson-only sync review instead of reimporting existing questions", () => {
  const job: GenerationJob = { id: "job", userId: "admin", title: "Paper sync", tasks: [], cursor: 1, error: null, leaseToken: null, createdAt: "2026-11-16", updatedAt: "2026-11-16", notified: false, status: "COMPLETED", results: [{ task: { path: "/api/admin/papers/lesson", body: { moduleId: "m" }, options: { syncExistingPapers: true } }, data: {} }] }
  expect(generationReviewAction(job)).toMatchObject({ path: "/api/admin/modules/m/sync-papers", body: { action: "save", jobId: "job" } })
})
