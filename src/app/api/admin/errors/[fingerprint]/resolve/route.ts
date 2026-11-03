import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { resolveErrorGroup } from "@/lib/monitoring"

/** POST: mark an error group as resolved (Admin → Monitoring). A new occurrence reopens it. */
export async function POST(_req: Request, { params }: { params: Promise<{ fingerprint: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error
  const { fingerprint } = await params
  if (!/^[0-9a-f]{32}$/.test(fingerprint)) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await resolveErrorGroup(fingerprint)
  return NextResponse.json({ ok: true })
}
