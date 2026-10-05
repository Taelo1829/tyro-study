import { chatJson } from "@/lib/ai/openai"
import { UNISA_CONTEXT, moduleLines } from "@/lib/ai/unisa"
import { prisma } from "@/lib/prisma"

/**
 * Study notes for failed quiz questions.
 *
 * The first time any student gets a question wrong, the AI writes a short
 * teaching note on the idea behind it. The note is saved on the question
 * (questions.studyNote) and never written again: everyone who misses that
 * question later gets the same note. It's also added to the end of the
 * topic's lesson, under "Common mistakes explained".
 *
 * The new columns are read and written with SQL so this works whether or not
 * the Prisma client has been regenerated since they were added.
 */

export const NOTES_HEADING = "Common mistakes explained"
/** A claim older than this is treated as abandoned (the request died) */
const CLAIM_MINUTES = 3

export interface QuestionNote {
  questionId: string
  question: string
  topicId: string | null
  html: string
}

const NOTE_PROMPT = `You write short study notes for UNISA students who got a multiple-choice question wrong.

${UNISA_CONTEXT}
- Define any technical term you use.

Write a note that teaches the idea the question tests, so the student gets it right next time and can answer similar questions:
1. A <h3> heading naming the concept (not "Question 3", not the question text).
2. Explain the concept clearly and briefly, then show how to reach the correct answer step by step (a worked example; use the question's own numbers if it has them).
3. Explain why the tempting wrong options are wrong (the misconception behind each), without listing every option mechanically.
Keep it to about 120-250 words. Don't mention "the quiz", "you got this wrong" or option letters; it is read as part of the lesson.

Formatting: HTML using only <h3> <p> <strong> <em> <ul> <ol> <li> <pre> <code>.
- Matrices: [[1, 2], [3, 4]]; powers as x^2; subscripts as x_1 or a_{ij}; fractions as 3/4, x/y or (a+b)/(c-d). Equations go in <p>; <pre><code> is only for program code (escape < and > as &lt; &gt;).
- No inline styles, links or images.

Respond with JSON only: { "html": "<the note HTML>" }`

interface QuestionRow {
  id: string
  question: string
  topicId: string | null
  chapterId: string | null
  studyNote: string | null
}

async function loadQuestions(ids: string[]): Promise<QuestionRow[]> {
  if (ids.length === 0) return []
  return prisma.$queryRaw<QuestionRow[]>`
    SELECT "id", "question", "topicId", "chapterId", "studyNote" FROM "questions" WHERE "id" = ANY(${ids})
  `
}

/** Take the job of writing this question's note; false if it exists or someone else is writing it */
async function claim(questionId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "questions" SET "studyNoteClaimedAt" = NOW()
    WHERE "id" = ${questionId}
      AND "studyNote" IS NULL
      AND ("studyNoteClaimedAt" IS NULL OR "studyNoteClaimedAt" < NOW() - (${CLAIM_MINUTES} * INTERVAL '1 minute'))
    RETURNING "id"
  `
  return rows.length > 0
}

async function release(questionId: string) {
  await prisma.$executeRaw`UPDATE "questions" SET "studyNoteClaimedAt" = NULL WHERE "id" = ${questionId} AND "studyNote" IS NULL`
}

/** Write one question's note with the AI */
async function writeNote(questionId: string): Promise<string> {
  const q = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      question: true,
      answers: { select: { answer: true, isCorrect: true } },
      topic: {
        select: {
          title: true,
          chapter: { select: { title: true, module: { select: { title: true, description: true } } } },
        },
      },
      chapter: { select: { title: true, module: { select: { title: true, description: true } } } },
    },
  })
  if (!q) throw new Error("Question not found")

  const chapter = q.topic?.chapter ?? q.chapter
  const correct = q.answers.find(a => a.isCorrect)?.answer ?? ""
  const wrong = q.answers.filter(a => !a.isCorrect).map(a => a.answer)
  const prompt = [
    ...(chapter ? moduleLines(chapter.module) : []),
    chapter ? `Chapter: ${chapter.title}` : "",
    q.topic ? `Topic: ${q.topic.title}` : "",
    "",
    `Question: ${q.question}`,
    `Correct answer: ${correct}`,
    `Wrong options: ${wrong.map(w => `"${w}"`).join("; ")}`,
  ]
    .filter(line => line !== "")
    .join("\n")

  const parsed = await chatJson<{ html?: unknown }>({ system: NOTE_PROMPT, user: prompt, temperature: 0.4, maxTokens: 2500 })
  const html = typeof parsed.html === "string" ? parsed.html.trim() : ""
  if (!html) throw new Error("The AI didn't return a note")
  return html
}

/**
 * Save the note on the question (only if it still has none) and add it to the
 * end of the topic's lesson. Both are single SQL statements, so a lesson
 * edited at the same time isn't overwritten.
 */
async function saveNote(row: QuestionRow, html: string): Promise<string> {
  const saved = await prisma.$queryRaw<{ studyNote: string }[]>`
    UPDATE "questions" SET "studyNote" = ${html}, "studyNoteClaimedAt" = NULL
    WHERE "id" = ${row.id} AND "studyNote" IS NULL
    RETURNING "studyNote"
  `
  if (saved.length === 0) {
    // Someone else's note landed first: use theirs
    const [current] = await loadQuestions([row.id])
    return current?.studyNote ?? html
  }

  if (row.topicId) {
    const heading = `<h2>${NOTES_HEADING}</h2>`
    await prisma.$executeRaw`
      UPDATE "topics"
      SET "content" = COALESCE("content", '')
        || CASE WHEN COALESCE("content", '') LIKE ${`%${heading}%`} THEN '' ELSE ${`\n${heading}`} END
        || ${`\n${html}`}
      WHERE "id" = ${row.topicId}
    `
  }
  return html
}

/**
 * Notes for these questions: existing ones straight away, missing ones written
 * now (a few at a time). A question whose note another request is writing
 * right now is skipped this time.
 */
export async function notesForQuestions(questionIds: string[]): Promise<QuestionNote[]> {
  const rows = await loadQuestions([...new Set(questionIds)].slice(0, 30))
  const out = new Map<string, QuestionNote>()

  const missing: QuestionRow[] = []
  for (const row of rows) {
    if (row.studyNote) out.set(row.id, { questionId: row.id, question: row.question, topicId: row.topicId, html: row.studyNote })
    else missing.push(row)
  }

  const queue = [...missing]
  const busyElsewhere: QuestionRow[] = []
  const worker = async () => {
    while (queue.length) {
      const row = queue.shift()!
      if (!(await claim(row.id))) { busyElsewhere.push(row); continue }
      try {
        const html = await saveNote(row, await writeNote(row.id))
        out.set(row.id, { questionId: row.id, question: row.question, topicId: row.topicId, html })
      } catch (err) {
        console.error("Question note failed:", row.id, err)
        await release(row.id)
      }
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker))

  // Another student's request is writing these right now: wait for it (up to ~60s)
  // instead of writing the same note twice.
  for (let tries = 0; busyElsewhere.length && tries < 30; tries++) {
    await new Promise(r => setTimeout(r, 2000))
    const ready = await loadQuestions(busyElsewhere.map(r => r.id))
    for (const row of ready) {
      if (!row.studyNote) continue
      out.set(row.id, { questionId: row.id, question: row.question, topicId: row.topicId, html: row.studyNote })
      busyElsewhere.splice(busyElsewhere.findIndex(r => r.id === row.id), 1)
    }
  }

  // Same order as asked
  return questionIds.map(id => out.get(id)).filter((n): n is QuestionNote => !!n)
}
