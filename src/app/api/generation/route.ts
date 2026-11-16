import { after, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { enqueueGeneration, generationJobs, generationSummaries, retryGeneration, runGenerationStep } from "@/lib/generation-jobs"
import { isGenerationTask } from "@/lib/generation-types"
export const runtime = "nodejs"
export const maxDuration = 300
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { error, user } = await requireAdmin()
  if (error) return error
  const id = new URL(request.url).searchParams.get("id") ?? undefined
  // Lists never contain source documents, private answer keys, or large results.
  return NextResponse.json(id ?
    (await generationJobs(user!.id, id))[0] ?? null :
    await generationSummaries(user!.id), { headers: { "Cache-Control": "no-store" } })
}
export async function POST(request: Request) {
  const { error, user } = await requireAdmin()
  if (error) return error
  try {
    const raw = await request.text()
    if (raw.length > 8_000_000) return NextResponse.json({ error: "This generation batch is too large." }, { status: 413 })
    const body = JSON.parse(raw)
    if (typeof body.retryId === "string") {
      const job = await retryGeneration(user!.id, body.retryId)
      if (!job) return NextResponse.json({ error: "Choose one of your failed generation jobs." }, { status: 409 })
      after(runGenerationStep)
      return NextResponse.json({ id: job.id, status: job.status }, { status: 202 })
    }
    if (!Array.isArray(body.tasks) || !body.tasks.length || body.tasks.length > 500 || !body.tasks.every(isGenerationTask)) return NextResponse.json({ error: "Unsupported generation task." }, { status: 400 })
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "Generation"
    const job = await enqueueGeneration(user!.id, title || "Generation", body.tasks)
    after(runGenerationStep)
    return NextResponse.json({ id: job.id, status: job.status }, { status: 202 })
  } catch (error) {
    console.error("Could not queue generation", error)
    return NextResponse.json({ error: "Could not queue generation. Check that the database migration is installed, then retry." }, { status: 503 })
  }
}
