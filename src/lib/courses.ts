import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { toPlainText } from "@/lib/plain-text"

/**
 * Courses sit at the top of the hierarchy: Course > Module > Chapter > Topic.
 * A module can be part of several courses (e.g. a maths module shared by two
 * degrees) or of none ("Other modules").
 *
 * The tables are read and written with SQL so this works whether or not the
 * Prisma client has been regenerated since they were added.
 */
export interface CourseRow {
  id: string
  title: string
  description: string | null
  createdAt: Date
  /** In the order the admin arranged them */
  moduleIds: string[]
}

export async function listCourses(): Promise<CourseRow[]> {
  return prisma.$queryRaw<CourseRow[]>`
    SELECT c."id", c."title", c."description", c."createdAt",
           COALESCE(
             array_agg(cm."moduleId" ORDER BY cm."position", cm."moduleId") FILTER (WHERE cm."moduleId" IS NOT NULL),
             '{}'
           ) AS "moduleIds"
    FROM "courses" c
    LEFT JOIN "course_modules" cm ON cm."courseId" = c."id"
    GROUP BY c."id"
    ORDER BY lower(c."title")`
}

export async function getCourse(id: string): Promise<CourseRow | null> {
  const rows = await prisma.$queryRaw<CourseRow[]>`
    SELECT c."id", c."title", c."description", c."createdAt",
           COALESCE(
             array_agg(cm."moduleId" ORDER BY cm."position", cm."moduleId") FILTER (WHERE cm."moduleId" IS NOT NULL),
             '{}'
           ) AS "moduleIds"
    FROM "courses" c
    LEFT JOIN "course_modules" cm ON cm."courseId" = c."id"
    WHERE c."id" = ${id}
    GROUP BY c."id"`
  return rows[0] ?? null
}

/** moduleId -> ids of the courses it belongs to */
export async function courseIdsByModule(): Promise<Map<string, string[]>> {
  const rows = await prisma.$queryRaw<{ moduleId: string; courseId: string }[]>`
    SELECT "moduleId", "courseId" FROM "course_modules"`
  const map = new Map<string, string[]>()
  for (const r of rows) map.set(r.moduleId, [...(map.get(r.moduleId) ?? []), r.courseId])
  return map
}

export function cleanCourseInput(body: { title?: unknown; description?: unknown }) {
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : ""
  const description = typeof body.description === "string" ? toPlainText(body.description).slice(0, 2000) || null : null
  return { title, description }
}

export async function createCourse(title: string, description: string | null): Promise<CourseRow> {
  const id = randomUUID()
  await prisma.$executeRaw`INSERT INTO "courses" ("id", "title", "description") VALUES (${id}, ${title}, ${description})`
  return (await getCourse(id))!
}

export async function updateCourse(id: string, title: string, description: string | null): Promise<boolean> {
  const n = await prisma.$executeRaw`UPDATE "courses" SET "title" = ${title}, "description" = ${description} WHERE "id" = ${id}`
  return n > 0
}

/** Deletes the course only; its modules stay (they just leave this course) */
export async function deleteCourse(id: string): Promise<boolean> {
  const n = await prisma.$executeRaw`DELETE FROM "courses" WHERE "id" = ${id}`
  return n > 0
}

/**
 * Replaces the course's module list; the order given is the order students see.
 * One SQL statement (no transaction), so it can't hit Prisma's transaction
 * time limit on a slow or distant database.
 */
export async function setCourseModules(courseId: string, moduleIds: string[]) {
  const ids = [...new Set(moduleIds)]
  await prisma.$executeRaw`
    WITH removed AS (
      DELETE FROM "course_modules"
      WHERE "courseId" = ${courseId} AND NOT ("moduleId" = ANY(${ids}::text[]))
    )
    INSERT INTO "course_modules" ("courseId", "moduleId", "position")
    SELECT ${courseId}, m."id", picked.ord - 1
    FROM unnest(${ids}::text[]) WITH ORDINALITY AS picked(id, ord)
    JOIN "modules" m ON m."id" = picked.id
    ON CONFLICT ("courseId", "moduleId") DO UPDATE SET "position" = EXCLUDED."position"`
}

/** Adds one module to the end of a course (no change if it's already there) */
export async function addModuleToCourse(courseId: string, moduleId: string) {
  await prisma.$executeRaw`
    INSERT INTO "course_modules" ("courseId", "moduleId", "position")
    SELECT ${courseId}, ${moduleId}, COALESCE(MAX("position") + 1, 0) FROM "course_modules" WHERE "courseId" = ${courseId}
    ON CONFLICT ("courseId", "moduleId") DO NOTHING`
}

/** Puts a module into exactly these courses (used from the module's edit window). One statement, like setCourseModules. */
export async function setModuleCourses(moduleId: string, courseIds: string[]) {
  const ids = [...new Set(courseIds)]
  await prisma.$executeRaw`
    WITH removed AS (
      DELETE FROM "course_modules"
      WHERE "moduleId" = ${moduleId} AND NOT ("courseId" = ANY(${ids}::text[]))
    )
    INSERT INTO "course_modules" ("courseId", "moduleId", "position")
    SELECT c."id", ${moduleId},
           COALESCE((SELECT MAX(cm."position") + 1 FROM "course_modules" cm WHERE cm."courseId" = c."id"), 0)
    FROM "courses" c
    WHERE c."id" = ANY(${ids}::text[])
    ON CONFLICT ("courseId", "moduleId") DO NOTHING`
}
