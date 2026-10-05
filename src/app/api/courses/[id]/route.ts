import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { cleanCourseInput, deleteCourse, getCourse, updateCourse } from "@/lib/courses"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const course = await getCourse((await params).id)
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })
  return NextResponse.json(course)
}

export async function PATCH(request: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const { title, description } = cleanCourseInput(await request.json().catch(() => ({})))
  if (!title) return NextResponse.json({ error: "The course needs a name" }, { status: 400 })
  if (!(await updateCourse(id, title, description))) return NextResponse.json({ error: "Course not found" }, { status: 404 })

  return NextResponse.json(await getCourse(id))
}

/** Removes the course only. Its modules, chapters and topics are kept. */
export async function DELETE(_request: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  if (!(await deleteCourse((await params).id))) return NextResponse.json({ error: "Course not found" }, { status: 404 })
  return NextResponse.json({ success: true })
}
