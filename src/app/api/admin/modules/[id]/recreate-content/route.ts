import { recreationFailure } from "@/lib/recreation-error"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { draftModuleLesson, draftMockExam, saveModuleLessons } from "@/lib/module-recreation"
import { parsePaperSources, parseReplacements, RecreationInputError } from "@/lib/module-recreation-input"
import { validateExamDraft, examValidationPayload, type ExamDraft } from "@/lib/exam-structure"
import { analyseAssignments, assignmentQuizPlans } from "@/lib/assignment-quiz-format"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const maxDuration = 300

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Context) {
  const { error } = await requireAdmin()
  if (error) return error
  const { id } = await params
  const mod = await prisma.module.findUnique({
    where: { id },
    select: { title: true, chapters: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, topics: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, content: true } } } } },
  })
  if (!mod) return NextResponse.json({ error: "Module not found" }, { status: 404 })
  return NextResponse.json(mod, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request, { params }: Context) {
  const { error } = await requireAdmin()
  if (error) return error
  const { id } = await params
  let stage = "draft"
  try {
    const raw = await request.text()
    if (new TextEncoder().encode(raw).length > 3_000_000) throw new RecreationInputError("This batch is too large. Select fewer papers or lessons.")
    let body
    try { body = JSON.parse(raw) } catch { throw new RecreationInputError("Invalid request.") }
    if (!body || typeof body !== "object") throw new RecreationInputError("Invalid request.")
    stage = body.action === "save" ? "save" : "draft"
    if (body.action === "assignments" || body.action === "draft") {
      const sources = parsePaperSources(body.sources)
      const topics = await prisma.topic.findMany({ where: { chapter: { moduleId: id } }, select: { id: true, title: true, chapter: { select: { title: true } } } })
      if (body.action === "assignments") return NextResponse.json(await analyseAssignments(sources, topics.map(t => ({ id: t.id, title: t.title, chapter: t.chapter.title }))))
      if (typeof body.topicId !== "string") throw new RecreationInputError("Choose a topic.")
      const plans = assignmentQuizPlans(body.assignmentAnalysis, sources, topics.map(t => t.id))
      return NextResponse.json(await draftModuleLesson(id, body.topicId, sources, plans[body.topicId] ?? null, body.assignmentAnalysis?.unresolved ?? []))
    }
    if (body.action === "exam") {
      const sources = parsePaperSources(body.sources)
      if (!Number.isInteger(body.referenceIndex) || !sources[body.referenceIndex]) throw new RecreationInputError("Select the previous exam to follow.")
      return NextResponse.json(await draftMockExam(sources[body.referenceIndex]))
    }
    if (body.action === "save") {
      const lessons = Array.isArray(body.lessons) && body.lessons.length === 0 ? [] : parseReplacements(body.lessons)
      if (lessons.some(l => !l.questions?.length && !l.quizUnchanged)) throw new RecreationInputError("Generate the topic quizzes before saving.")
      if (!body.assessment || typeof body.assessment !== "object") throw new RecreationInputError("Review the mock exam decision before saving.")
      let exam: ExamDraft | null = null
      if (body.assessment.exam) {
        if (body.assessment.confirmed !== true) throw new RecreationInputError("Confirm that the mock matches the supplied previous exam.")
        const sources = parsePaperSources(body.sources)
        if (!Number.isInteger(body.referenceIndex) || !sources[body.referenceIndex]) throw new RecreationInputError("The reference exam is missing.")
        exam = validateExamDraft(examValidationPayload(body.assessment.exam), sources[body.referenceIndex])
      }
      const reason = exam ? "" : "No verified, supported previous-exam structure has been supplied."
      return NextResponse.json({ saved: await saveModuleLessons(id, lessons, { exam, reason }) })
    }
    throw new RecreationInputError("Choose draft or save.")
  } catch (err) {
    if (err instanceof RecreationInputError) return NextResponse.json({ error: err.message }, { status: 400 })
    captureError("Module content recreation failed", err, "/api/admin/modules/[id]/recreate-content")
    const failure = recreationFailure(err, stage)
    return NextResponse.json({ error: failure.error }, { status: failure.status })
  }
}
