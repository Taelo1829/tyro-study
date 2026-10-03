import { NextResponse } from "next/server"
import { del } from "@vercel/blob"
import { requireAdmin } from "@/lib/admin"
import { isTextbookBlobUrl } from "@/lib/ai/textbook"

/** DELETE { url } - remove a textbook's saved pages (or an unread PDF) once the import is finished */
export async function DELETE(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error
  const body = (await request.json().catch(() => ({}))) as { url?: unknown }
  if (!isTextbookBlobUrl(body.url)) return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  await del(body.url).catch(err => console.warn("Textbook: could not delete", err))
  return NextResponse.json({ ok: true })
}
