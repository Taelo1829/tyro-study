import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { generateTopicProjects } from "@/lib/ai/projects"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const maxDuration = 120

/** POST { count } - the AI writes `count` (1–5) coding projects for the topic */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireAdmin()
    if (error) return error
    const body = (await request.json().catch(() => ({}))) as { count?: unknown }
    const count = Math.max(1, Math.min(5, Math.floor(Number(body.count) || 2)))
    const added = await generateTopicProjects((await params).id, count)
    return NextResponse.json({ added })
  } catch (err) {
    captureError("Generate projects error", err, "/api/topics/[id]/projects/generate")
    const message = err instanceof Error ? err.message : "Couldn't write the projects"
    return NextResponse.json({ error: message }, { status: message.includes("OPENAI_API_KEY") ? 503 : 500 })
  }
}
