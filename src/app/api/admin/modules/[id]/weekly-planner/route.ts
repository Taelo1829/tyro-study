import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { weeklyPlannerEnabled } from "@/lib/weekly-planner-settings"
type Context = { params: Promise<{ id: string }> }
export async function GET(_request: Request, { params }: Context) {
  const { error } = await requireAdmin()
  if (error) return error
  try { return NextResponse.json({ enabled: await weeklyPlannerEnabled((await params).id) }) }
  catch { return NextResponse.json({ error: "Could not load the weekly planner setting." }, { status: 503 }) }
}
export async function PATCH(request: Request, { params }: Context) {
  const { error } = await requireAdmin()
  if (error) return error
  const body = await request.json().catch(() => ({}))
  if (typeof body.enabled !== "boolean") return NextResponse.json({ error: "Choose on or off." }, { status: 400 })
  try {
    const id = (await params).id
    const changed = await prisma.$executeRaw`UPDATE "modules" SET "weeklyPlannerEnabled" = ${body.enabled} WHERE "id" = ${id}`
    if (!changed) return NextResponse.json({ error: "Module not found." }, { status: 404 })
    return NextResponse.json({ enabled: body.enabled })
  } catch { return NextResponse.json({ error: "Could not save the setting. Make sure the latest database migrations have been applied." }, { status: 503 }) }
}
