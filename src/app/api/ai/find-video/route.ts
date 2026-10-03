import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { lessonVideoIds, suggestTopicVideo } from "@/lib/ai/videos"

/**
 * POST { topicId, exclude?: string[], tried?: string[] } → { description, query, video, reason, alternatives }
 *
 * Finds a YouTube video for a topic. Nothing is saved here: the lesson editor
 * adds the chosen video to the lesson and saves it. Videos already in the
 * lesson (and any in `exclude`) are skipped.
 */

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const { error } = await requireAdmin()
    if (error) return error

    const body = (await request.json().catch(() => ({}))) as { topicId?: unknown; exclude?: unknown; tried?: unknown }
    if (typeof body.topicId !== "string") return NextResponse.json({ error: "topicId is required" }, { status: 400 })
    const topic = await prisma.topic.findUnique({ where: { id: body.topicId }, select: { content: true } })
    if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 })

    const exclude = [
      ...lessonVideoIds(topic.content),
      ...(Array.isArray(body.exclude) ? body.exclude.filter((x): x is string => typeof x === "string") : []),
    ]
    // Searches already tried ("Search again"), so the AI writes a different one
    const tried = (Array.isArray(body.tried) ? body.tried : []).filter((x): x is string => typeof x === "string").slice(-5)
    return NextResponse.json(await suggestTopicVideo(body.topicId, { exclude, tried }))
  } catch (err) {
    console.error("Find video error:", err)
    const message = err instanceof Error ? err.message : "Couldn't find a video"
    const notConfigured = /YOUTUBE_API_KEY|OPENAI_API_KEY/.test(message)
    return NextResponse.json({ error: message }, { status: notConfigured ? 503 : 500 })
  }
}
