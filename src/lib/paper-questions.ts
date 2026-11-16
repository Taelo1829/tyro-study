import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { ASSIGNMENT_CHECKPOINT, ASSIGNMENT_QUIZ, RecreationInputError } from "./module-recreation-input"
import type { AssessmentConfig } from "./module-assessments"
import { questionDuplicates, type ComparableQuestion } from "./question-duplicates"
import { parseReplacements } from "./module-recreation-input"
import { lessonVersion } from "./module-recreation"
import { lessonSummary, sanitizeTopicContentServer } from "./topic-content-server"

export function isPaperLessonTopic(topic: { id: string; title: string }) {
  return !topic.id.startsWith("assignment-") && !topic.title.startsWith(ASSIGNMENT_CHECKPOINT) && !topic.title.startsWith(ASSIGNMENT_QUIZ)
}
const normalize = (value: string) => value.normalize("NFC").replace(/\s+/g, " ").trim()
function signature(question: string, answers: { answer: string; isCorrect: boolean }[]) {
  return JSON.stringify([normalize(question), answers.map(a => [normalize(a.answer), a.isCorrect]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))])
}

export async function savePaperQuestions(moduleId: string, paper: string, input: unknown, lessonDrafts?: unknown) {
  if (!Array.isArray(input) || !input.length || input.length > 300) throw new RecreationInputError("Choose between 1 and 300 paper questions to save.")
  const lessons = lessonDrafts === undefined ? null : parseReplacements(lessonDrafts)
  // Semantic checks happen before opening the write transaction so network calls
  // do not hold the module lock. The transaction still checks exact duplicates.
  const [snapshot] = await prisma.$queryRaw<{ assessmentConfig: string | null }[]>`SELECT "assessmentConfig" FROM "modules" WHERE "id" = ${moduleId}`
  if (!snapshot) throw new RecreationInputError("Module not found.")
  const retiredIds = new Set<string>(snapshot.assessmentConfig ? JSON.parse(snapshot.assessmentConfig).retiredQuestionIds ?? [] : [])
  const destinations = (await prisma.topic.findMany({ where: { chapter: { moduleId } }, select: { id: true, title: true, questions: { select: { id: true, question: true, answers: { select: { answer: true, isCorrect: true } } } } } })).filter(isPaperLessonTopic)
  const checked = [...input]
  for (const topic of destinations) {
    const candidates: (ComparableQuestion & { index: number })[] = []
    input.forEach((raw, index) => {
      if (raw?.topicId !== topic.id || typeof raw.question !== "string" || !raw.question.trim() || raw.question.length > 10000 || !Array.isArray(raw.options) || raw.options.length < 2 || raw.options.length > 6 || !raw.options.every((o: unknown) => typeof o === "string" && o.trim() && o.length <= 3000) || typeof raw.correctOption !== "string") return
      const options = raw.options.map((o: string) => o.trim()) as string[]
      if (new Set(options).size !== options.length || !options.includes(raw.correctOption.trim())) return
      candidates.push({ index, question: raw.question.trim(), options, correctOption: raw.correctOption.trim() })
    })
    if (!candidates.length) continue
    const existing = topic.questions.filter(q => !retiredIds.has(q.id)).map(q => ({ question: q.question, options: q.answers.map(a => a.answer), correctOption: q.answers.find(a => a.isCorrect)?.answer ?? "" }))
    const duplicates = await questionDuplicates(candidates, existing)
    for (const [index, match] of duplicates) {
      const position = candidates[index].index
      checked[position] = { ...checked[position], question: match.question, options: match.options, correctOption: match.correctOption }
    }
  }
  return prisma.$transaction(async tx => {
    const [row] = await tx.$queryRaw<{ assessmentConfig: string | null }[]>`SELECT "assessmentConfig" FROM "modules" WHERE "id" = ${moduleId} FOR UPDATE`
    if (!row) throw new RecreationInputError("Module not found.")
    const config: AssessmentConfig | null = row.assessmentConfig ? JSON.parse(row.assessmentConfig) : null
    const retired = new Set(config?.retiredQuestionIds ?? [])
    const topics = (await tx.topic.findMany({ where: { chapter: { moduleId } }, select: { id: true, title: true, questions: { select: { id: true, question: true, answers: { select: { answer: true, isCorrect: true } } } } } })).filter(isPaperLessonTopic)
    const byTopic = new Map(topics.map(t => [t.id, t]))
    const seen = new Map(topics.map(t => [t.id, new Map(t.questions.filter(q => !retired.has(q.id)).map(q => [signature(q.question, q.answers), q.id]))]))
    const prepared: { id: string; topicId: string; question: string; difficulty: string; answers: { answer: string; isCorrect: boolean }[] }[] = []
    const included = new Set<string>()
    const affected = new Set<string>()
    let skipped = 0
    for (const raw of checked) {
      const topicId = typeof raw?.topicId === "string" ? raw.topicId : ""
      const question = typeof raw?.question === "string" ? raw.question.trim() : ""
      const options: string[] = Array.isArray(raw?.options) && raw.options.every((o: unknown) => typeof o === "string") ? raw.options.map((o: string) => o.trim()) : []
      const correct = typeof raw?.correctOption === "string" ? raw.correctOption.trim() : ""
      const topic = byTopic.get(topicId)
      if (!topic || !question || question.length > 10000 || options.length < 2 || options.length > 6 || options.some(o => !o || o.length > 3000) || new Set(options).size !== options.length || !options.includes(correct)) { skipped++; continue }
      const answers = options.map(answer => ({ answer, isCorrect: answer === correct }))
      const key = signature(question, answers)
      let id = seen.get(topicId)!.get(key)
      if (id) skipped++
      else {
        id = randomUUID()
        prepared.push({ id, topicId, question, difficulty: ["easy", "medium", "hard"].includes(raw.difficulty) ? raw.difficulty : "medium", answers })
        seen.get(topicId)!.set(key, id)
      }
      included.add(id); affected.add(topicId)
      // Older modules use an explicit allow-list. Append paper questions without
      // replacing other active questions, chapter pools, or the exam template.
      if (config) {
        config.topicPools ??= {}
        const current = config.topicPools[topicId] ?? topic.questions.filter(q => !retired.has(q.id)).map(q => q.id)
        config.topicPools[topicId] = [...new Set([...current, id])]
      }
    }
    if (prepared.length) {
      await tx.question.createMany({ data: prepared.map(q => ({ id: q.id, topicId: q.topicId, question: q.question, difficulty: q.difficulty })) })
      await tx.answer.createMany({ data: prepared.flatMap(q => q.answers.map((a, i) => ({ ...a, id: `${q.id}-${i}`, questionId: q.id }))) })
    }
    if (lessons) {
      if (lessons.length !== affected.size || new Set(lessons.map(l => l.topicId)).size !== affected.size || lessons.some(l => !affected.has(l.topicId))) throw new RecreationInputError("Review one lesson update for every selected topic before saving.")
      for (const lesson of lessons) {
        const topic = await tx.topic.findFirst({ where: { id: lesson.topicId, chapter: { moduleId } } })
        if (!topic || !isPaperLessonTopic(topic)) throw new RecreationInputError("A targeted topic was removed. Generate fresh lesson drafts.")
        const html = sanitizeTopicContentServer(lesson.html)
        if (!lessonSummary(html)) throw new RecreationInputError("A lesson draft is empty.")
        if (topic.content === html) continue
        if (lessonVersion(topic) !== lesson.version) throw new RecreationInputError("A topic changed after drafting. Nothing was saved. Generate fresh lesson drafts.")
        const updated = await tx.topic.updateMany({ where: { id: topic.id, chapterId: topic.chapterId, title: topic.title, content: topic.content }, data: { content: html } })
        if (updated.count !== 1) throw new RecreationInputError("A topic changed while saving. Nothing was saved.")
      }
    }
    if (included.size) await tx.$executeRaw`UPDATE "questions" SET "paper" = COALESCE("paper", ${paper}) WHERE "id" = ANY(${[...included]}::text[])`
    if (config && included.size) await tx.$executeRaw`UPDATE "modules" SET "assessmentConfig" = ${JSON.stringify(config)} WHERE "id" = ${moduleId}`
    return { added: prepared.length, skipped, paper, topics: affected.size, lessonsUpdated: lessons?.length ?? 0 }
  }, { maxWait: 10000, timeout: 90000 })
}
