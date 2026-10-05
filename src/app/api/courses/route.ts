import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { cleanCourseInput, createCourse, listCourses } from "@/lib/courses"
import { courseLevels, getUserLevel, setCourseLevel } from "@/lib/levels-server"
import { isStudyLevel } from "@/lib/levels"

/**
 * All courses (grades, for high school) with their module ids in order, and
 * their level. Used by Browse modules and admin. Students (and ?scope=mine)
 * only get the courses of their own level.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  const mine = new URL(request.url).searchParams.get("scope") === "mine" || session?.user?.role !== "ADMIN"
  const [courses, levels] = await Promise.all([listCourses(), courseLevels()])
  const userLevel = mine && session?.user?.id ? await getUserLevel(session.user.id) : null
  const withLevel = courses.map(c => ({ ...c, level: levels.get(c.id) ?? "tertiary" }))
  return NextResponse.json(userLevel ? withLevel.filter(c => c.level === userLevel) : withLevel)
}

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const { title, description } = cleanCourseInput(body)
  if (!title) return NextResponse.json({ error: "The course needs a name" }, { status: 400 })

  const course = await createCourse(title, description)
  const level = isStudyLevel(body.level) ? body.level : "tertiary"
  if (level !== "tertiary") await setCourseLevel(course.id, level)
  return NextResponse.json({ ...course, level }, { status: 201 })
}
