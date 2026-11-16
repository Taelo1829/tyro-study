import { timingSafeEqual } from "node:crypto"
import { after, NextResponse } from "next/server"
import { generationWorkerSecret, runGenerationStep } from "@/lib/generation-jobs"
export const runtime = "nodejs"
export const maxDuration = 300
export const dynamic = "force-dynamic"
export async function POST(request: Request) {
  const expected = generationWorkerSecret()
  const provided = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? ""
  const cron = process.env.CRON_SECRET
  const matches = (secret: string | null | undefined) => !!secret && Buffer.byteLength(provided) === Buffer.byteLength(secret) && timingSafeEqual(Buffer.from(provided), Buffer.from(secret))
  if (!matches(expected) && !matches(cron)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  after(runGenerationStep)
  return NextResponse.json({ accepted: true }, { status: 202 })
}
export const GET = POST
