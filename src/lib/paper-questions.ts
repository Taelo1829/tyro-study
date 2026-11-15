import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { ASSIGNMENT_CHECKPOINT, ASSIGNMENT_QUIZ, RecreationInputError } from "./module-recreation-input"
import type { AssessmentConfig } from "./module-assessments"

export function isPaperLessonTopic(topic: { id: string; title: string }) {
  return !topic.id.startsWith("assignment-") && !topic.title.startsWith(ASSIGNMENT_CHECKPOINT) && !topic.title.startsWith(ASSIGNMENT_QUIZ)
}
const normalize = (value: string) => value.normalize("NFC").replace(/\s+/g, " ").trim()
function signature(question: string, answers: { answer: string; isCorrect: boolean }[]) {
  return JSON.stringify([normalize(question), answers.map(a => [normalize(a.answer), a.isCorrect]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))])
}

export async function savePaperQuestions(moduleId: string, paper: string, input: unknown) {
  if (!Array.isArray(input) || !input.length || input.length > 300) throw new RecreationInputError("Choose between 1 and 300 paper questions to save.")
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
    for (const raw of input) {
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
    if (included.size) await tx.$executeRaw`UPDATE "questions" SET "paper" = COALESCE("paper", ${paper}) WHERE "id" = ANY(${[...included]}::text[])`
    if (config && included.size) await tx.$executeRaw`UPDATE "modules" SET "assessmentConfig" = ${JSON.stringify(config)} WHERE "id" = ${moduleId}`
    return { added: prepared.length, skipped, paper, topics: affected.size }
  }, { maxWait: 10000, timeout: 90000 })
}
