import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { parsePaperSources, RecreationInputError } from "@/lib/module-recreation-input"
import { applyTutorialLetter, draftTutorialTask, getTutorialPreview, planTutorialLetter, tutorialDraftDetail } from "@/lib/tutorial-letter"

export const runtime = "nodejs"
export const maxDuration = 300
type Context = { params: Promise<{ id: string }> }
export async function GET(_request: Request, { params }: Context) {
  const { error } = await requireAdmin()
  if (error) return error
  try { return NextResponse.json(await getTutorialPreview((await params).id)) }
  catch { return NextResponse.json({ error: "Could not load tutorial-letter drafts. Check that database migrations have been applied." }, { status: 503 }) }
}
export async function POST(request: Request, { params }: Context) {
  const { error } = await requireAdmin()
  if (error) return error
  try {
    const raw = await request.text()
    if (raw.length > 1_000_000) throw new RecreationInputError("Use PDFs containing no more than 120,000 characters in total.")
    const body = JSON.parse(raw)
    const moduleId = (await params).id
    if (body.action === "plan") {
      const sources = parsePaperSources(body.contents ? [body.source, body.contents] : [body.source])
      return NextResponse.json(await planTutorialLetter(moduleId, sources[0], sources[1]))
    }
    if (typeof body.importId !== "string" || body.importId.length > 100) throw new RecreationInputError("Choose a tutorial-letter draft.")
    if (body.action === "apply" && body.reviewed === true) return NextResponse.json(await applyTutorialLetter(moduleId, body.importId))
    if (typeof body.key === "string" && body.key.length < 100) {
      if (body.action === "draft") return NextResponse.json(await draftTutorialTask(moduleId, body.importId, body.key))
      if (body.action === "detail") return NextResponse.json(await tutorialDraftDetail(moduleId, body.importId, body.key))
    }
    throw new RecreationInputError("Review the complete draft before replacing the module.")
  } catch (error) {
    if (error instanceof RecreationInputError || error instanceof SyntaxError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error("Tutorial letter import failed", error)
    return NextResponse.json({ error: "Could not complete this step. Your current module is unchanged and completed drafts are saved. Retry to continue." }, { status: 500 })
  }
}
