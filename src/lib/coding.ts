import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { orFallback } from "@/lib/db-safe"
import { moduleCode } from "@/lib/ai/unisa"
import { CODING_LANGUAGES, type CodingLanguage, type ProjectFeedback, type RubricItem } from "@/lib/coding-shared"

/**
 * Coding modules and their projects.
 *
 * A module is a coding module when its `codingLanguage` is set to a language,
 * or, while it's left on automatic (NULL), when its code starts with one of
 * AUTO_PREFIXES (UNISA computing modules), in C++.
 *
 * Tables are read and written with SQL so this works whether or not the
 * Prisma client has been regenerated since they were added.
 */

export const AUTO_PREFIXES = ["COS", "INF", "ICT"]

export interface ModuleCoding {
  /** The language, or null when it isn't a coding module */
  language: CodingLanguage | null
  /** Still decided from the module code (the admin hasn't chosen) */
  auto: boolean
}

export function resolveCoding(title: string, stored: string | null): ModuleCoding {
  if (stored === "none") return { language: null, auto: false }
  if (stored && stored in CODING_LANGUAGES) return { language: stored as CodingLanguage, auto: false }
  const code = moduleCode(title)?.code ?? ""
  return { language: AUTO_PREFIXES.some(p => code.startsWith(p)) ? "cpp" : null, auto: true }
}

export async function getModuleCoding(moduleId: string): Promise<ModuleCoding | null> {
  const [row] = await orFallback(
    () => prisma.$queryRaw<{ title: string; codingLanguage: string | null }[]>`
      SELECT "title", "codingLanguage" FROM "modules" WHERE "id" = ${moduleId}`,
    // Before the coding-projects migration: decide from the module code
    async () =>
      (await prisma.$queryRaw<{ title: string }[]>`SELECT "title" FROM "modules" WHERE "id" = ${moduleId}`).map(r => ({ ...r, codingLanguage: null }))
  )
  return row ? resolveCoding(row.title, row.codingLanguage) : null
}

export async function getTopicCoding(topicId: string): Promise<(ModuleCoding & { moduleId: string }) | null> {
  const [row] = await orFallback(
    () => prisma.$queryRaw<{ id: string; title: string; codingLanguage: string | null }[]>`
      SELECT m."id", m."title", m."codingLanguage" FROM "topics" t
      JOIN "chapters" c ON c."id" = t."chapterId" JOIN "modules" m ON m."id" = c."moduleId"
      WHERE t."id" = ${topicId}`,
    async () =>
      (await prisma.$queryRaw<{ id: string; title: string }[]>`
        SELECT m."id", m."title" FROM "topics" t
        JOIN "chapters" c ON c."id" = t."chapterId" JOIN "modules" m ON m."id" = c."moduleId"
        WHERE t."id" = ${topicId}`).map(r => ({ ...r, codingLanguage: null }))
  )
  return row ? { ...resolveCoding(row.title, row.codingLanguage), moduleId: row.id } : null
}

/** "auto" | "none" | a language */
export async function setModuleCoding(moduleId: string, value: string) {
  const stored = value === "auto" ? null : value === "none" ? "none" : value in CODING_LANGUAGES ? value : undefined
  if (stored === undefined) throw new Error("Unknown language")
  await prisma.$executeRaw`UPDATE "modules" SET "codingLanguage" = ${stored} WHERE "id" = ${moduleId}`
}

// ---------------------------------------------------------------- projects

export interface ProjectRow {
  id: string
  topicId: string
  title: string
  brief: string
  language: CodingLanguage
  starterCode: string | null
  rubric: RubricItem[]
  difficulty: string
  order: number
}

interface RawProject extends Omit<ProjectRow, "rubric"> {
  rubric: string
}

const parseProject = (r: RawProject): ProjectRow => ({ ...r, rubric: safeJson<RubricItem[]>(r.rubric, []) })

function safeJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

export async function listProjects(topicId: string): Promise<ProjectRow[]> {
  const rows = await orFallback(
    () => prisma.$queryRaw<RawProject[]>`
      SELECT "id", "topicId", "title", "brief", "language", "starterCode", "rubric", "difficulty", "order"
      FROM "coding_projects" WHERE "topicId" = ${topicId} ORDER BY "order", "createdAt"`,
    [] as RawProject[] // (before the migration: none)
  )
  return rows.map(parseProject)
}

export async function getProject(id: string): Promise<ProjectRow | null> {
  const [row] = await prisma.$queryRaw<RawProject[]>`
    SELECT "id", "topicId", "title", "brief", "language", "starterCode", "rubric", "difficulty", "order"
    FROM "coding_projects" WHERE "id" = ${id}`
  return row ? parseProject(row) : null
}

export async function countProjects(topicId: string): Promise<number> {
  const [row] = await prisma.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS "n" FROM "coding_projects" WHERE "topicId" = ${topicId}`
  return row?.n ?? 0
}

export async function createProject(
  topicId: string,
  p: { title: string; brief: string; language: CodingLanguage; starterCode: string | null; rubric: RubricItem[]; difficulty: string }
): Promise<string> {
  const id = randomUUID()
  await prisma.$executeRaw`
    INSERT INTO "coding_projects" ("id", "topicId", "title", "brief", "language", "starterCode", "rubric", "difficulty", "order")
    SELECT ${id}, ${topicId}, ${p.title}, ${p.brief}, ${p.language}, ${p.starterCode}, ${JSON.stringify(p.rubric)}, ${p.difficulty},
           COALESCE(MAX("order") + 1, 0) FROM "coding_projects" WHERE "topicId" = ${topicId}`
  return id
}

export async function deleteProject(id: string): Promise<boolean> {
  return (await prisma.$executeRaw`DELETE FROM "coding_projects" WHERE "id" = ${id}`) > 0
}

// ---------------------------------------------------------------- submissions

export interface SubmissionRow {
  id: string
  score: number
  feedback: ProjectFeedback
  files: { name: string; content: string }[]
  createdAt: Date
}

export async function listSubmissions(projectId: string, userId: string): Promise<SubmissionRow[]> {
  const rows = await prisma.$queryRaw<{ id: string; score: number; feedback: string; files: string; createdAt: Date }[]>`
    SELECT "id", "score", "feedback", "files", "createdAt" FROM "project_submissions"
    WHERE "projectId" = ${projectId} AND "userId" = ${userId} ORDER BY "createdAt" DESC LIMIT 20`
  return rows.map(r => ({
    id: r.id,
    score: r.score,
    createdAt: r.createdAt,
    feedback: safeJson<ProjectFeedback>(r.feedback, { summary: "", rubric: [], strengths: [], improvements: [] }),
    files: safeJson(r.files, []),
  }))
}

/** Best score per project for a student (for the topic's project list) */
export async function bestScores(projectIds: string[], userId: string): Promise<Map<string, { best: number; tries: number }>> {
  if (projectIds.length === 0) return new Map()
  const rows = await orFallback(
    () => prisma.$queryRaw<{ projectId: string; best: number; tries: number }[]>`
      SELECT "projectId", MAX("score")::int AS "best", COUNT(*)::int AS "tries" FROM "project_submissions"
      WHERE "userId" = ${userId} AND "projectId" = ANY(${projectIds}::text[]) GROUP BY "projectId"`,
    []
  )
  return new Map(rows.map(r => [r.projectId, { best: r.best, tries: r.tries }]))
}

export async function submissionsToday(projectId: string, userId: string): Promise<number> {
  const [row] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS "n" FROM "project_submissions"
    WHERE "projectId" = ${projectId} AND "userId" = ${userId} AND "createdAt" > NOW() - INTERVAL '1 day'`
  return row?.n ?? 0
}

export async function saveSubmission(projectId: string, userId: string, files: { name: string; content: string }[], score: number, feedback: ProjectFeedback): Promise<string> {
  const id = randomUUID()
  await prisma.$executeRaw`
    INSERT INTO "project_submissions" ("id", "projectId", "userId", "files", "score", "feedback")
    VALUES (${id}, ${projectId}, ${userId}, ${JSON.stringify(files)}, ${score}, ${JSON.stringify(feedback)})`
  return id
}
