import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { cleanCourseInput, createCourse, listCourses } from "@/lib/courses"

/** All courses with their module ids (in order). Used by Browse modules and admin. */
export async function GET() {
  return NextResponse.json(await listCourses())
}

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const { title, description } = cleanCourseInput(await request.json().catch(() => ({})))
  if (!title) return NextResponse.json({ error: "The course needs a name" }, { status: 400 })

  return NextResponse.json(await createCourse(title, description), { status: 201 })
}
