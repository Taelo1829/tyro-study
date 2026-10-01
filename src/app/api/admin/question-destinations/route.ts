import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { getQuestionModuleId } from "@/lib/questions"

// GET /api/admin/question-destinations?questionId=… — admin only.
// The chapters and topics of the question's own module, for the
// "Move question" picker (moves are limited to the same module).
export async function GET(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const questionId = new URL(request.url).searchParams.get("questionId")
  if (!questionId) {
    return NextResponse.json({ error: "questionId is required" }, { status: 400 })
  }

  const moduleId = await getQuestionModuleId(questionId)
  if (moduleId === undefined) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 })
  }

  const modules = await prisma.module.findMany({
    // A question that somehow isn't attached anywhere can go to any module
    where: moduleId ? { id: moduleId } : undefined,
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      chapters: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          topics: {
            orderBy: { order: "asc" },
            select: { id: true, title: true },
          },
        },
      },
    },
  })

  return NextResponse.json(modules)
}
