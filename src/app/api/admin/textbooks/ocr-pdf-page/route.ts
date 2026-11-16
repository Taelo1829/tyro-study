import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { isTextbookBlobUrl, MAX_TEXTBOOK_BYTES } from "@/lib/ai/textbook"
import { POST as transcribe } from "../ocr/route"
export const maxDuration = 300
export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error
  const body = await request.json()
  if (!isTextbookBlobUrl(body.url) || !Number.isInteger(body.page) || body.page < 1 || body.page > 1000) return NextResponse.json({ error: "Choose a stored PDF page" }, { status: 400 })
  const response = await fetch(body.url, { redirect: "error" })
  if (!response.ok) return NextResponse.json({ error: "The uploaded PDF is unavailable" }, { status: 410 })
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength > MAX_TEXTBOOK_BYTES) return NextResponse.json({ error: "PDF is too large" }, { status: 413 })
  const { CanvasFactory } = await import("pdf-parse/worker")
  const { PDFParse } = await import("pdf-parse")
  const parser = new PDFParse({ data: new Uint8Array(bytes), CanvasFactory })
  try {
    const screenshot = await parser.getScreenshot({ partial: [body.page], desiredWidth: 1200, imageBuffer: false, imageDataUrl: true })
    if (!screenshot.pages[0]) return NextResponse.json({ error: "PDF page not found" }, { status: 400 })
    return transcribe(new Request("http://generation.internal/ocr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: body.page, image: screenshot.pages[0].dataUrl }) }))
  } finally { await parser.destroy() }
}
