import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { savePaperQuestions } from "@/lib/paper-questions"
import { RecreationInputError } from "@/lib/module-recreation-input"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error
  const body = await request.json().catch(() => ({}))
  if (typeof body.moduleId !== "string" || !body.moduleId.trim()) return NextResponse.json({ error: "moduleId is required" }, { status: 400 })
  const paper = typeof body.paper === "string" && body.paper.trim() ? body.paper.trim().slice(0, 120) : "Past paper"
  try { return NextResponse.json(await savePaperQuestions(body.moduleId, paper, body.questions)) }
  catch (error) {
    if (error instanceof RecreationInputError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error("Question paper save failed", error)
    return NextResponse.json({ error: "Could not add the paper questions. Nothing was saved. Please retry." }, { status: 500 })
  }
}
