import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { parsePaperSources, parseReplacements, RecreationInputError } from "@/lib/module-recreation-input"
import { draftUploadedAssignment, draftAssignmentLesson, saveUploadedAssignment } from "@/lib/uploaded-assignment"
import { lessonSummary } from "@/lib/topic-content-server"
import { captureError } from "@/lib/monitoring"
import { recreationFailure } from "@/lib/recreation-error"
export const runtime = "nodejs"
export const maxDuration = 300
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error
  let stage = "draft"
  try {
    const { id } = await params
    const raw = await request.text()
    if (Buffer.byteLength(raw) > 4000000) throw new RecreationInputError("This assignment is too large.")
    const body = JSON.parse(raw)
    const [source] = parsePaperSources([body?.source])
    if (source.text.length > 40000) throw new RecreationInputError("Upload an assignment with at most 40,000 characters of text.")
    if (body.action === "draft") {
      const chapters = await prisma.chapter.findMany({ where: { moduleId: id }, orderBy: [{ order: "asc" }, { createdAt: "asc" }, { id: "asc" }], include: { topics: { select: { id: true, title: true, content: true } } } })
      if (!chapters.length) throw new RecreationInputError("Add the module’s chapters and topics before uploading an assignment.")
      return NextResponse.json(await draftUploadedAssignment(source, chapters.map(ch => ({ ...ch, topics: ch.topics.map(t => ({ ...t, content: lessonSummary(t.content, 1200) })) }))))
    }
    if (body.action === "lesson") {
      if (typeof body.topicId !== "string") throw new RecreationInputError("Choose a targeted topic.")
      return NextResponse.json(await draftAssignmentLesson(id, source, body.matches, body.topicId))
    }
    if (body.action !== "save" || typeof body.title !== "string" || !body.title.trim() || body.title.length > 150) throw new RecreationInputError("Review the assignment before adding it.")
    stage = "save"
    return NextResponse.json(await saveUploadedAssignment(id, source, body.title.trim(), body.matches, body.questions, parseReplacements(body.lessons)))
  } catch (err) {
    if (err instanceof RecreationInputError || err instanceof SyntaxError) return NextResponse.json({ error: err.message }, { status: 400 })
    captureError("Upload assignment failed", err, "/api/admin/modules/[id]/assignments")
    const failure = recreationFailure(err, stage)
    return NextResponse.json({ error: failure.error }, { status: failure.status })
  }
}
