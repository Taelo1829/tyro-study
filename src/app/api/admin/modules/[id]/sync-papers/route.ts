import { after, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { enqueueGeneration, generationJobs, runGenerationStep } from "@/lib/generation-jobs"
import { isPaperLessonTopic } from "@/lib/paper-questions"
import { parsePaperSources, parseReplacements, RecreationInputError } from "@/lib/module-recreation-input"
import { saveModuleLessons } from "@/lib/module-recreation"
import type { GenerationTask } from "@/lib/generation-types"

export const maxDuration = 300
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireAdmin()
  if (error) return error
  const { id } = await params
  try {
    const body = await request.json()
    if (body.action === "save") {
      if (typeof body.jobId !== "string") throw new RecreationInputError("Choose the completed sync job to review.")
      const [job] = await generationJobs(user!.id, body.jobId)
      if (!job || job.status !== "COMPLETED" || !job.results.length || !job.results.every(r => r.task.path === "/api/admin/papers/lesson" && r.task.body.moduleId === id && r.task.options?.syncExistingPapers === true)) throw new RecreationInputError("This module's paper sync is not ready to save.")
      const lessons = parseReplacements(job.results.map(r => r.data))
      const topics = await prisma.topic.findMany({ where: { id: { in: lessons.map(l => l.topicId) }, chapter: { moduleId: id } }, select: { id: true, title: true } })
      if (topics.length !== lessons.length || !topics.every(isPaperLessonTopic)) throw new RecreationInputError("The targeted topics have changed. Start a fresh sync.")
      return NextResponse.json({ lessonsUpdated: await saveModuleLessons(id, lessons) })
    }
    if (body.action !== "start") throw new RecreationInputError("Choose start or save.")
    const [mod] = await prisma.$queryRaw<{ title: string; assessmentConfig: string | null }[]>`SELECT "title", "assessmentConfig" FROM "modules" WHERE "id" = ${id}`
    if (!mod) throw new RecreationInputError("Module not found.")
    const retired = new Set<string>(mod.assessmentConfig ? JSON.parse(mod.assessmentConfig).retiredQuestionIds ?? [] : [])
    const topics = await prisma.topic.findMany({
      where: { chapter: { moduleId: id }, questions: { some: { paper: { not: null } } } },
      orderBy: [{ chapterId: "asc" }, { order: "asc" }],
      select: { id: true, title: true, questions: { where: { paper: { not: null } }, orderBy: { id: "asc" }, select: { id: true, paper: true, question: true, kind: true, answers: { select: { answer: true, isCorrect: true } } } } },
    })
    const tasks: GenerationTask[] = topics.filter(isPaperLessonTopic).flatMap(topic => {
      const questions = topic.questions.filter(q => !retired.has(q.id) && q.paper?.trim()).map(q => ({ topicId: topic.id, paper: q.paper, question: q.question, kind: q.kind, options: q.answers.map(a => a.answer), correctOption: q.answers.find(a => a.isCorrect)?.answer ?? "" }))
      if (!questions.length) return []
      const [source] = parsePaperSources([{ name: "Previously uploaded question papers", text: JSON.stringify(questions) }])
      return [{ path: "/api/admin/papers/lesson", label: `Sync lesson: ${topic.title}`, body: { moduleId: id, topicId: topic.id, source, questions }, options: { syncExistingPapers: true } }]
    })
    if (!tasks.length) throw new RecreationInputError("No uploaded paper questions are linked to lesson topics in this module yet.")
    if (tasks.length > 200) throw new RecreationInputError("This module has more than 200 affected lessons. Sync smaller modules separately.")
    const job = await enqueueGeneration(user!.id, `Sync paper lessons: ${mod.title}`, tasks)
    after(runGenerationStep)
    return NextResponse.json({ id: job.id, topics: tasks.length }, { status: 202 })
  } catch (error) {
    if (error instanceof RecreationInputError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error("Paper lesson sync failed", error)
    return NextResponse.json({ error: "Could not sync paper lessons. Please try again." }, { status: 500 })
  }
}
