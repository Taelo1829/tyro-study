import { prisma } from "@/lib/prisma"
import { blankQuestionIds } from "@/lib/question-kinds"

/**
 * A short taster quiz for public lesson pages (/notes/<id>): a few of the
 * topic's multiple-choice questions, marked in the browser. The full quiz,
 * scoring history and study notes stay behind sign-in.
 *
 * Only questions with exactly one correct option and at least two options are
 * used; type-the-answer ("blank") questions are left out. Because the sample is
 * marked in the browser, the correct option of these few questions is sent to
 * the page - that's fine for a public taster.
 */

export interface SampleQuestion {
  id: string
  text: string
  options: { id: string; text: string }[]
  correctId: string
}

export interface PublicQuizSample {
  questions: SampleQuestion[]
  /** Every multiple-choice and type-the-answer question on the topic */
  total: number
}

export const SAMPLE_SIZE = 5

function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function getPublicQuizSample(topicId: string, size = SAMPLE_SIZE): Promise<PublicQuizSample> {
  try {
    const rows = await prisma.question.findMany({
      where: { topicId },
      select: { id: true, question: true, answers: { select: { id: true, answer: true, isCorrect: true } } },
    })
    const blanks = await blankQuestionIds(rows.map(r => r.id))

    const usable = rows.filter(
      q => !blanks.has(q.id) && q.answers.length >= 2 && q.answers.filter(a => a.isCorrect).length === 1
    )
    const questions = shuffle(usable)
      .slice(0, size)
      .map(q => ({
        id: q.id,
        text: q.question,
        options: shuffle(q.answers).map(a => ({ id: a.id, text: a.answer })),
        correctId: q.answers.find(a => a.isCorrect)!.id,
      }))
    return { questions, total: rows.length }
  } catch (err) {
    // A quiz that fails to load shouldn't take the lesson down with it
    console.warn("Public quiz sample failed:", err instanceof Error ? err.message : err)
    return { questions: [], total: 0 }
  }
}
