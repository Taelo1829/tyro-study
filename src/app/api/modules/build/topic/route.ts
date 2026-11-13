import { recreationFailure } from "@/lib/recreation-error"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { parsePaperSources, RecreationInputError } from "@/lib/module-recreation-input"
import { analyseAssignments } from "@/lib/assignment-quiz-format"
import { draftModuleLesson, saveModuleLessons } from "@/lib/module-recreation"
import { ASSIGNMENT_CHECKPOINT } from "@/lib/document-module"
import { captureError } from "@/lib/monitoring"
export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error
  let stage = "draft"
  try {
    const raw = await request.text()
    if (new TextEncoder().encode(raw).length > 1_000_000) return NextResponse.json({ error: "Use fewer documents." }, { status: 413 })
    const body = JSON.parse(raw)
    if (!body || typeof body.topicId !== "string" || typeof body.moduleId !== "string") throw new RecreationInputError("Choose a module topic.")
    const sources = parsePaperSources(body.sources)
    const topic = await prisma.topic.findFirst({ where: { id: body.topicId, chapter: { moduleId: body.moduleId } }, include: { chapter: { include: { topics: { orderBy: { order: "asc" }, select: { title: true, order: true } } } } } })
    if (!topic) return NextResponse.json({ error: "Topic not found in this module" }, { status: 404 })
    // Creation only: retries never overwrite lessons edited or already completed.
    if (topic.content?.trim()) return NextResponse.json({ note: "Already created; existing content kept." })
    const checkpoint = topic.title.startsWith(ASSIGNMENT_CHECKPOINT)
    const scope = checkpoint ? topic.chapter.topics.filter(t => t.order < topic.order && !t.title.startsWith(ASSIGNMENT_CHECKPOINT)).map(t => t.title).join("; ") : topic.title
    if (!scope) throw new RecreationInputError("An assignment checkpoint needs preceding lessons.")
    const { analysis, plans } = await analyseAssignments(sources, [{ id: topic.id, title: scope, chapter: topic.chapter.title }])
    const context = checkpoint
      ? `This is a cumulative assignment checkpoint. Its prerequisite topics, already taught in this chapter, are: ${scope}. Write a short assignment brief with objectives, instructions, expected working and a checklist. Students use the assessment below the brief to submit answers (photos or PDFs for written questions). Do not reveal assessment solutions in the brief. Quiz questions for this checkpoint form the assignment: cover and combine these prerequisites, matching the source assignment format. Do not assess later topics.`
      : "Create the lesson and its topic quiz from the supplied documents."
    const draft = await draftModuleLesson(body.moduleId, topic.id, sources, plans[topic.id] ?? null, analysis.unresolved ?? [], context)
    if (draft.skipped) return NextResponse.json({ note: draft.reason })
    stage = "save"
    await saveModuleLessons(body.moduleId, [draft], { exam: null, reason: "No reviewed previous-exam structure has been supplied." })
    return NextResponse.json({ note: `${checkpoint ? "Assignment checkpoint" : "Lesson"}${draft.questions?.length ? ` · ${draft.questions.length} questions` : " only"}. ${draft.quizNote}` })
  } catch (err) {
    if (err instanceof RecreationInputError || err instanceof SyntaxError) return NextResponse.json({ error: err.message }, { status: 400 })
    captureError("Document module topic failed", err, "/api/modules/build/topic")
    const failure = recreationFailure(err, stage)
    return NextResponse.json({ error: failure.error }, { status: failure.status })
  }
}
