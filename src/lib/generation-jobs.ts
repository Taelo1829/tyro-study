import { createHash, createHmac, randomUUID } from "node:crypto"
import { prisma } from "./prisma"
import { dispatchGeneration } from "./generation-dispatch"
import { sendPushToUser } from "./web-push"
import type { GenerationJob, GenerationTask } from "./generation-types"

export function generationWorkerSecret() {
  const secret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
  return secret ? createHmac("sha256", secret).update("generation-worker-v1").digest("hex") : null
}
export async function enqueueGeneration(userId: string, title: string, tasks: GenerationTask[]) {
  const id = randomUUID()
  const dedupe = createHash("sha256").update(JSON.stringify(tasks)).digest("hex")
  const [job] = await prisma.$queryRaw<GenerationJob[]>`
    INSERT INTO "generation_jobs" ("id", "userId", "title", "dedupeKey", "tasks")
    VALUES (${id}, ${userId}, ${title}, ${dedupe}, ${JSON.stringify(tasks)}::jsonb)
    ON CONFLICT ("userId", "dedupeKey") WHERE "status" IN ('QUEUED','RUNNING')
    DO UPDATE SET "dedupeKey" = EXCLUDED."dedupeKey" RETURNING *`
  return job
}
export async function generationJobs(userId: string, id?: string) {
  return id ? prisma.$queryRaw<GenerationJob[]>`SELECT * FROM "generation_jobs" WHERE "userId" = ${userId} AND "id" = ${id}`
    : prisma.$queryRaw<GenerationJob[]>`SELECT * FROM "generation_jobs" WHERE "userId" = ${userId} ORDER BY "createdAt" DESC LIMIT 50`
}
export async function generationSummaries(userId: string) {
  return prisma.$queryRaw`SELECT "id", "title", "status", "cursor", jsonb_array_length("tasks") AS "total", "error", "createdAt", "updatedAt" FROM "generation_jobs" WHERE "userId" = ${userId} ORDER BY "createdAt" DESC LIMIT 50`
}
export async function retryGeneration(userId: string, id: string) {
  const [job] = await prisma.$queryRaw<GenerationJob[]>`UPDATE "generation_jobs" SET "status" = 'QUEUED', "error" = NULL, "notified" = false, "leaseToken" = NULL, "leaseUntil" = NULL, "updatedAt" = now() WHERE "id" = ${id} AND "userId" = ${userId} AND "status" = 'FAILED' RETURNING *`
  return job ?? null
}

/** Wake a new server invocation; never derive its destination from user input. */
export async function wakeGenerationWorker() {
  const localUrl = `http://localhost:${process.env.PORT || "4000"}`
  const base = process.env.GENERATION_WORKER_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.NODE_ENV === "production" ? process.env.NEXTAUTH_URL || localUrl : localUrl)
  const secret = generationWorkerSecret()
  if (!secret) throw new Error("Set NEXTAUTH_SECRET or CRON_SECRET for background generation")
  const headers: Record<string, string> = { authorization: `Bearer ${secret}` }
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) headers["x-vercel-protection-bypass"] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  const response = await fetch(new URL("/api/generation/run", base), { method: "POST", headers, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Generation worker could not be reached (${response.status})`)
}

async function notifyFinished() {
  const jobs = await prisma.$queryRaw<Pick<GenerationJob, "id" | "userId" | "title" | "status">[]>`SELECT "id", "userId", "title", "status" FROM "generation_jobs" WHERE "status" IN ('COMPLETED','FAILED') AND "notified" = false ORDER BY "updatedAt" LIMIT 20`
  for (const job of jobs) {
    try {
      await sendPushToUser(job.userId, {
        title: job.status === "COMPLETED" ? `${job.title} is ready` : `${job.title} needs attention`,
        body: job.status === "COMPLETED" ? "Open Generation activity to review the results." : "Completed work is saved. Open Generation activity for details.",
        url: `/admin/generation?job=${job.id}`, tag: `generation-${job.id}`,
      })
      await prisma.$executeRaw`UPDATE "generation_jobs" SET "notified" = true WHERE "id" = ${job.id}`
    } catch (error) { console.error("Generation notification failed", error) }
  }
}

/** One durable checkpoint per invocation. Leases prevent overlapping workers. */
export async function runGenerationStep() {
  await prisma.$executeRaw`UPDATE "generation_jobs" SET "status" = 'FAILED', "error" = 'The worker was interrupted. Completed steps are saved; review the latest content before retrying.', "leaseToken" = NULL, "updatedAt" = now() WHERE "status" = 'RUNNING' AND "leaseUntil" < now()`
  const token = randomUUID()
  const [job] = await prisma.$queryRaw<GenerationJob[]>`
    UPDATE "generation_jobs" SET "status" = 'RUNNING', "leaseToken" = ${token}, "leaseUntil" = now() + interval '7 minutes', "updatedAt" = now()
    WHERE "id" = (SELECT "id" FROM "generation_jobs" WHERE "status" = 'QUEUED' ORDER BY "updatedAt" FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`
  if (job) {
    try {
      // Recheck privileges for every step, including work queued before demotion.
      const user = await prisma.user.findUnique({ where: { id: job.userId }, select: { role: true } })
      if (user?.role !== "ADMIN") throw new Error("Administrator access is required to continue generation")
      const task = job.tasks[job.cursor]
      if (!task) throw new Error("The saved generation task is missing")
      const { data, next } = await dispatchGeneration(job.userId, task, job.results)
      const tasks = [...job.tasks.slice(0, job.cursor + 1), ...next, ...job.tasks.slice(job.cursor + 1)]
      const results = [...job.results, { task, data }]
      const cursor = job.cursor + 1
      const status = cursor >= tasks.length ? "COMPLETED" : "QUEUED"
      await prisma.$executeRaw`UPDATE "generation_jobs" SET "tasks" = ${JSON.stringify(tasks)}::jsonb, "results" = ${JSON.stringify(results)}::jsonb, "cursor" = ${cursor}, "status" = ${status}, "leaseToken" = NULL, "leaseUntil" = NULL, "updatedAt" = now() WHERE "id" = ${job.id} AND "leaseToken" = ${token}`
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed"
      await prisma.$executeRaw`UPDATE "generation_jobs" SET "status" = 'FAILED', "error" = ${message.slice(0, 2000)}, "leaseToken" = NULL, "leaseUntil" = NULL, "updatedAt" = now() WHERE "id" = ${job.id} AND "leaseToken" = ${token}`
    }
  }
  await notifyFinished()
  const [pending] = await prisma.$queryRaw<{ count: number }[]>`SELECT count(*)::int AS count FROM "generation_jobs" WHERE "status" = 'QUEUED'`
  if (pending.count) await wakeGenerationWorker().catch(error => console.error("Generation wake failed; scheduled worker will recover queued work", error))
}
