import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { getCourse, setCourseModules } from "@/lib/courses"

type Params = { params: Promise<{ id: string }> }

/** PUT { moduleIds } replaces the course's modules; the order given is the order students see */
export async function PUT(request: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  if (!(await getCourse(id))) return NextResponse.json({ error: "Course not found" }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as { moduleIds?: unknown }
  if (!Array.isArray(body.moduleIds) || body.moduleIds.some(m => typeof m !== "string")) {
    return NextResponse.json({ error: "moduleIds must be a list of module ids" }, { status: 400 })
  }

  await setCourseModules(id, body.moduleIds as string[])
  return NextResponse.json(await getCourse(id))
}
