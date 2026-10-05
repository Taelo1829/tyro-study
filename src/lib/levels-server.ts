import { prisma } from "@/lib/prisma"
import { orFallback } from "@/lib/db-safe"
import { asLevel, type StudyLevel } from "@/lib/levels"

/**
 * Study levels in the database. The `level` columns are read and written with
 * SQL; before their migration has run everyone and everything is tertiary.
 */

export async function getUserLevel(userId: string): Promise<StudyLevel> {
  const [row] = await orFallback(
    () => prisma.$queryRaw<{ level: string }[]>`SELECT "level" FROM "users" WHERE "id" = ${userId}`,
    []
  )
  return asLevel(row?.level)
}

export async function setUserLevel(userId: string, level: StudyLevel) {
  await prisma.$executeRaw`UPDATE "users" SET "level" = ${level} WHERE "id" = ${userId}`
}

/** moduleId → level, for every module */
export async function moduleLevels(): Promise<Map<string, StudyLevel>> {
  const rows = await orFallback(() => prisma.$queryRaw<{ id: string; level: string }[]>`SELECT "id", "level" FROM "modules"`, [])
  return new Map(rows.map(r => [r.id, asLevel(r.level)]))
}

export async function getModuleLevel(moduleId: string): Promise<StudyLevel> {
  const [row] = await orFallback(
    () => prisma.$queryRaw<{ level: string }[]>`SELECT "level" FROM "modules" WHERE "id" = ${moduleId}`,
    []
  )
  return asLevel(row?.level)
}

export async function setModuleLevel(moduleId: string, level: StudyLevel) {
  await prisma.$executeRaw`UPDATE "modules" SET "level" = ${level} WHERE "id" = ${moduleId}`
}

/** courseId → level, for every course */
export async function courseLevels(): Promise<Map<string, StudyLevel>> {
  const rows = await orFallback(() => prisma.$queryRaw<{ id: string; level: string }[]>`SELECT "id", "level" FROM "courses"`, [])
  return new Map(rows.map(r => [r.id, asLevel(r.level)]))
}

export async function setCourseLevel(courseId: string, level: StudyLevel) {
  await prisma.$executeRaw`UPDATE "courses" SET "level" = ${level} WHERE "id" = ${courseId}`
}

/** The grade course (Grade 11 / Grade 12) for high school subjects, created if it's missing */
export async function gradeCourseId(grade: number): Promise<string> {
  const id = `grade-${grade}`
  await prisma.$executeRaw`
    INSERT INTO "courses" ("id", "title", "description", "level")
    VALUES (${id}, ${`Grade ${grade}`}, ${`Grade ${grade} subjects (CAPS)`}, 'highschool')
    ON CONFLICT ("id") DO NOTHING`
  return id
}
