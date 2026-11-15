import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth-session"
import { getTutorialGuide } from "@/lib/tutorial-letter"
import { weeklyPlannerEnabled } from "@/lib/weekly-planner-settings"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAuthUserId()) return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  try {
    const { id } = await params
    if (!await weeklyPlannerEnabled(id)) return NextResponse.json(null)
    return NextResponse.json(await getTutorialGuide(id))
  }
  catch { return NextResponse.json({ error: "Study guide is temporarily unavailable." }, { status: 503 }) }
}
