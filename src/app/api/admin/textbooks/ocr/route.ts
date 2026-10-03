import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { getOpenAIClient } from "@/lib/ai/openai"

/**
 * POST { page, image } → { page, text }
 *
 * OCR for scanned textbooks: the admin's browser renders one page of the PDF
 * as a JPEG (data URL) and the AI transcribes its text. Nothing is stored.
 */

export const runtime = "nodejs"
export const maxDuration = 120

const MAX_IMAGE_CHARS = 3_500_000 // ~2.6MB of JPEG as base64

const OCR_PROMPT = `Transcribe all the text on this scanned textbook page, exactly as written, in reading order.
- Keep headings on their own lines, with their numbering (e.g. "2.3 Linear equations").
- Keep paragraphs, list items, exercise numbers and table rows on separate lines.
- Write maths as plain text: x^2, sqrt(x), a/b, ≤, ×, and matrices as [[1, 2], [3, 4]].
- Ignore page decorations; include the printed page number on its own line if there is one.
- If the page has no text (blank or only a picture), reply with nothing.
Reply with the transcription only, no comments.`

export async function POST(request: Request) {
  try {
    const { error } = await requireAdmin()
    if (error) return error

    const body = (await request.json().catch(() => ({}))) as { page?: unknown; image?: unknown }
    const page = Number(body.page)
    const image = typeof body.image === "string" ? body.image : ""
    if (!Number.isInteger(page) || page < 1 || !/^data:image\/(jpeg|png|webp);base64,/.test(image)) {
      return NextResponse.json({ error: "page and image are required" }, { status: 400 })
    }
    if (image.length > MAX_IMAGE_CHARS) return NextResponse.json({ error: "Page image is too large" }, { status: 413 })

    const openai = getOpenAIClient()
    let text = ""
    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_VISION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0,
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: OCR_PROMPT },
              { type: "image_url", image_url: { url: image, detail: "high" } },
            ],
          },
        ],
      })
      const choice = response.choices[0]
      text = (choice?.message?.content ?? "").trim()
      // Stuck repeating itself until the limit: try once more
      if (choice?.finish_reason !== "length") break
    }

    return NextResponse.json({ page, text: text.slice(0, 20_000) })
  } catch (err) {
    console.error("Textbook OCR error:", err)
    const message = err instanceof Error ? err.message : "Couldn't read this page"
    return NextResponse.json({ error: message }, { status: message.includes("OPENAI_API_KEY") ? 503 : 500 })
  }
}
