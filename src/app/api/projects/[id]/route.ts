import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { requireAuth } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import { getTopicLock, lockedResponseBody } from "@/lib/topic-locks"
import { deleteProject, getProject, listSubmissions } from "@/lib/coding"

type Params = { params: Promise<{ id: string }> }

/** GET → the project (brief, starter code, rubric), its topic, and the student's submissions */
export async function GET(_request: Request, { params }: Params) {
  const { error, session } = await requireAuth()
  if (error) return error
  const project = await getProject((await params).id)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
  if (session?.user?.role !== "ADMIN") {
    const lock = await getTopicLock(session!.user.id, project.topicId)
    if (lock) return NextResponse.json(lockedResponseBody(lock), { status: 403 })
  }
  const topic = await prisma.topic.findUnique({
    where: { id: project.topicId },
    select: { id: true, title: true, chapter: { select: { id: true, title: true, module: { select: { id: true, title: true } } } } },
  })
  const submissions = await listSubmissions(project.id, session!.user.id)
  return NextResponse.json({ project, topic, submissions })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error
  if (!(await deleteProject((await params).id))) return NextResponse.json({ error: "Project not found" }, { status: 404 })
  return NextResponse.json({ success: true })
}
