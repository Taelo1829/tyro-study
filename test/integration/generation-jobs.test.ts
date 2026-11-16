import { PGlite } from "@electric-sql/pglite"
import { readFile } from "node:fs/promises"
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest"
import { Prisma } from "@/prisma/client"
import { prisma } from "@/lib/prisma"
import { enqueueGeneration, generationJobs, retryGeneration, runGenerationStep } from "@/lib/generation-jobs"

const m = vi.hoisted(() => ({ dispatch: vi.fn(), push: vi.fn(), user: vi.fn() }))
vi.mock("@/lib/generation-dispatch", () => ({ dispatchGeneration: m.dispatch }))
vi.mock("@/lib/web-push", () => ({ sendPushToUser: m.push }))
const db = new PGlite()
const task = { path: "/api/ai/generate-questions", body: { topicId: "topic" } }
async function query(strings: TemplateStringsArray, ...values: unknown[]) {
  const sql = Prisma.sql(strings, ...values)
  return db.query(sql.text, sql.values as unknown[])
}
beforeAll(async () => {
  await db.exec('CREATE TABLE "users" ("id" TEXT PRIMARY KEY); INSERT INTO "users" VALUES (\'owner\'), (\'other\');')
  await db.exec(await readFile("prisma/migrations/20261115120000_generation_jobs/migration.sql", "utf8"))
  Object.assign(prisma, {
    $queryRaw: async (s: TemplateStringsArray, ...v: unknown[]) => (await query(s, ...v)).rows,
    $executeRaw: async (s: TemplateStringsArray, ...v: unknown[]) => (await query(s, ...v)).affectedRows ?? 0,
    user: { findUnique: m.user },
  })
})
beforeEach(async () => {
  await db.exec('DELETE FROM "generation_jobs"')
  vi.resetAllMocks()
  m.user.mockResolvedValue({ role: "ADMIN" })
  m.dispatch.mockResolvedValue({ data: { questions: ["saved draft"] }, next: [] })
  m.push.mockResolvedValue(1)
  vi.stubEnv("NEXTAUTH_SECRET", "test-worker-secret")
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 202 })))
})
afterAll(async () => { await db.close(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

it("notifies when paper questions are ready and links directly to their saved review", async () => {
  const read = { path: "/api/admin/papers/read", body: { moduleId: "module" } }
  const job = await enqueueGeneration("owner", "Content generation", [read])
  m.dispatch.mockResolvedValue({ data: { source: { name: "Exam", text: "Paper" }, questions: [{ question: "Question" }], topics: [{ id: "topic" }] }, next: [] })
  await runGenerationStep()
  expect(m.push).toHaveBeenCalledWith("owner", expect.objectContaining({ title: "Questions ready to review", body: expect.stringContaining("Prepare lesson updates"), url: `/admin/modules/module?paperJob=${job.id}` }))
  await runGenerationStep()
  expect(m.push).toHaveBeenCalledOnce()
})
it("notifies once all paper lessons are drafted and links to review before saving", async () => {
  const lesson = { path: "/api/admin/papers/lesson", body: { moduleId: "module", topicId: "one" } }
  const job = await enqueueGeneration("owner", "Question paper lesson updates", [lesson, { ...lesson, body: { ...lesson.body, topicId: "two" } }])
  m.dispatch.mockResolvedValue({ data: { html: "<p>Lesson draft</p>" }, next: [] })
  await runGenerationStep()
  expect(m.push).not.toHaveBeenCalled()
  await runGenerationStep()
  expect(m.push).toHaveBeenCalledWith("owner", expect.objectContaining({ title: "Lessons ready to review", body: expect.stringContaining("review the lessons"), url: `/admin/generation?job=${job.id}` }))
  await runGenerationStep()
  expect(m.push).toHaveBeenCalledOnce()
})
it("does not announce lessons ready when drafting fails", async () => {
  await enqueueGeneration("owner", "Question paper lesson updates", [{ path: "/api/admin/papers/lesson", body: { moduleId: "module", topicId: "one" } }])
  m.dispatch.mockRejectedValue(new Error("Draft failed"))
  await runGenerationStep()
  expect(m.push).toHaveBeenCalledWith("owner", expect.objectContaining({ title: "Question paper lesson updates needs attention" }))
})
it("deduplicates repeated active submissions and restricts results to the owner", async () => {
  const a = await enqueueGeneration("owner", "Questions", [task])
  const b = await enqueueGeneration("owner", "Questions", [task])
  expect(b.id).toBe(a.id)
  expect(await generationJobs("other", a.id)).toEqual([])
  expect((await generationJobs("owner", a.id))[0].tasks).toEqual([task])
})
it("persists follow-up tasks and resumes in another invocation without a browser", async () => {
  const job = await enqueueGeneration("owner", "Module", [task])
  m.dispatch.mockResolvedValueOnce({ data: { planned: true }, next: [{ ...task, body: { topicId: "next" } }] })
  await runGenerationStep()
  const checkpoint = (await generationJobs("owner", job.id))[0]
  expect(checkpoint).toMatchObject({ status: "QUEUED", cursor: 1 })
  expect(checkpoint.tasks).toHaveLength(2)
  expect(checkpoint.results).toHaveLength(1)
  expect(fetch).toHaveBeenCalled()
  await runGenerationStep()
  const completed = (await generationJobs("owner", job.id))[0]
  expect(completed).toMatchObject({ status: "COMPLETED", cursor: 2, notified: true })
  expect(completed.results).toHaveLength(2)
  expect(m.push).toHaveBeenCalledOnce()
})
it("retains completed steps and reports failure without continuing dependent work", async () => {
  const job = await enqueueGeneration("owner", "Lessons", [task, task, task])
  await runGenerationStep()
  m.dispatch.mockRejectedValueOnce(new Error("AI service unavailable"))
  await runGenerationStep()
  expect((await generationJobs("owner", job.id))[0]).toMatchObject({ status: "FAILED", cursor: 1, error: "AI service unavailable" })
  await runGenerationStep()
  expect(m.dispatch).toHaveBeenCalledTimes(2)
})
it("does not run work for an admin whose role was removed", async () => {
  const job = await enqueueGeneration("owner", "Questions", [task])
  m.user.mockResolvedValue({ role: "STUDENT" })
  await runGenerationStep()
  expect(m.dispatch).not.toHaveBeenCalled()
  expect((await generationJobs("owner", job.id))[0].status).toBe("FAILED")
})
it("retries in place without losing previous results or rerunning successful steps", async () => {
  const job = await enqueueGeneration("owner", "Lessons", [task, task])
  await runGenerationStep()
  m.dispatch.mockRejectedValueOnce(new Error("Temporary failure"))
  await runGenerationStep()
  expect(await retryGeneration("other", job.id)).toBeNull()
  expect(await retryGeneration("owner", job.id)).toMatchObject({ id: job.id, cursor: 1, status: "QUEUED" })
  await runGenerationStep()
  const finished = (await generationJobs("owner", job.id))[0]
  expect(finished.status).toBe("COMPLETED")
  expect(finished.results).toHaveLength(2)
  expect(m.dispatch).toHaveBeenCalledTimes(3)
})
it("prevents overlapping workers from executing the same active job", async () => {
  const job = await enqueueGeneration("owner", "Questions", [task])
  m.dispatch.mockImplementation(async () => { await new Promise(resolve => setTimeout(resolve, 20)); return { data: {}, next: [] } })
  await Promise.all([runGenerationStep(), runGenerationStep()])
  expect(m.dispatch).toHaveBeenCalledOnce()
  expect((await generationJobs("owner", job.id))[0].status).toBe("COMPLETED")
})
it("reports expired leases instead of silently repeating possibly committed writes", async () => {
  const job = await enqueueGeneration("owner", "Questions", [task])
  await db.query('UPDATE "generation_jobs" SET "status" = \'RUNNING\', "leaseUntil" = now() - interval \'1 minute\' WHERE "id" = $1', [job.id])
  await runGenerationStep()
  expect(m.dispatch).not.toHaveBeenCalled()
  expect((await generationJobs("owner", job.id))[0]).toMatchObject({ status: "FAILED", notified: true })
})
