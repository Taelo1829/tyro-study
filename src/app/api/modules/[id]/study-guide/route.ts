import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth-session"
import { getTutorialGuide } from "@/lib/tutorial-letter"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAuthUserId()) return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  try { return NextResponse.json(await getTutorialGuide((await params).id)) }
  catch { return NextResponse.json({ error: "Study guide is temporarily unavailable." }, { status: 503 }) }
}
