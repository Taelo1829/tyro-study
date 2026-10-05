import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { orFallback } from "@/lib/db-safe"
import { answerMatches } from "@/lib/code-blanks"

/**
 * "Try it yourself" exercises in coding lessons: a short piece of code with
 * blanks (____) the student fills in, checked on the server.
 *
 * Read and written with SQL so this works whether or not the Prisma client
 * has been regenerated since the table was added.
 */

export interface ExerciseBlank {
  /** Accepted answers (any one is right) */
  answers: string[]
}

export interface ExerciseRow {
  id: string
  topicId: string
  title: string
  instructions: string
  code: string
  blanks: ExerciseBlank[]
  explanation: string | null
  language: string
  order: number
}

/** What a student sees before answering: no answers or explanation */
export type PublicExercise = Omit<ExerciseRow, "blanks" | "explanation"> & { blankCount: number }

interface RawExercise extends Omit<ExerciseRow, "blanks"> {
  blanks: string
}

function parseBlanks(text: string): ExerciseBlank[] {
  try {
    const list = JSON.parse(text)
    return Array.isArray(list)
      ? list.map((b: { answers?: unknown }) => ({ answers: Array.isArray(b?.answers) ? b.answers.map(String) : [] }))
      : []
  } catch {
    return []
  }
}

const parse = (r: RawExercise): ExerciseRow => ({ ...r, blanks: parseBlanks(r.blanks) })

export function toPublic(e: ExerciseRow): PublicExercise {
  return { id: e.id, topicId: e.topicId, title: e.title, instructions: e.instructions, code: e.code, language: e.language, order: e.order, blankCount: e.blanks.length }
}

export async function listExercises(topicId: string): Promise<ExerciseRow[]> {
  const rows = await orFallback(
    () => prisma.$queryRaw<RawExercise[]>`
      SELECT "id", "topicId", "title", "instructions", "code", "blanks", "explanation", "language", "order"
      FROM "topic_exercises" WHERE "topicId" = ${topicId} ORDER BY "order", "createdAt"`,
    [] as RawExercise[] // (before the migration: none)
  )
  return rows.map(parse)
}

export async function getExercise(id: string): Promise<ExerciseRow | null> {
  const [row] = await prisma.$queryRaw<RawExercise[]>`
    SELECT "id", "topicId", "title", "instructions", "code", "blanks", "explanation", "language", "order"
    FROM "topic_exercises" WHERE "id" = ${id}`
  return row ? parse(row) : null
}

export async function createExercise(
  topicId: string,
  e: { title: string; instructions: string; code: string; blanks: ExerciseBlank[]; explanation: string | null; language: string }
): Promise<string> {
  const id = randomUUID()
  await prisma.$executeRaw`
    INSERT INTO "topic_exercises" ("id", "topicId", "title", "instructions", "code", "blanks", "explanation", "language", "order")
    SELECT ${id}, ${topicId}, ${e.title}, ${e.instructions}, ${e.code}, ${JSON.stringify(e.blanks)}, ${e.explanation}, ${e.language},
           COALESCE(MAX("order") + 1, 0) FROM "topic_exercises" WHERE "topicId" = ${topicId}`
  return id
}

export async function deleteExercise(id: string): Promise<boolean> {
  return (await prisma.$executeRaw`DELETE FROM "topic_exercises" WHERE "id" = ${id}`) > 0
}

export async function countExercises(topicId: string): Promise<number> {
  const [row] = await orFallback(
    () => prisma.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS "n" FROM "topic_exercises" WHERE "topicId" = ${topicId}`,
    [{ n: 0 }]
  )
  return row?.n ?? 0
}

/** Which blanks are right */
export function checkExercise(e: ExerciseRow, answers: string[]): boolean[] {
  return e.blanks.map((b, i) => answerMatches(String(answers[i] ?? ""), b.answers))
}
