import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { extractTextFromPdf } from "@/lib/ai/pdf-parser"
import { extractQuestionsFromText } from "@/lib/ai/question-generator"
import { captureError } from "@/lib/monitoring"
import { isTextbookBlobUrl, readTextbookPdf, textbookFromOcr, NoTextError } from "@/lib/ai/textbook"
import { del } from "@vercel/blob"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = await request.json()
      if (body.ocr) {
        const pages = textbookFromOcr(body.ocr).pages
        if (!pages.length || pages.length > 100) return NextResponse.json({ error: "Use a PDF of up to 100 pages" }, { status: 400 })
        return NextResponse.json(await extractQuestionsFromText(pages.join("\n\n")))
      }
      if (!isTextbookBlobUrl(body.url)) return NextResponse.json({ error: "Upload a PDF first" }, { status: 400 })
      const pdf = await fetch(body.url, { redirect: "error" })
      if (!pdf.ok) return NextResponse.json({ error: "Uploaded PDF is unavailable" }, { status: 410 })
      const bytes = Buffer.from(await pdf.arrayBuffer())
      if (bytes.length > 10 * 1024 * 1024) return NextResponse.json({ error: "PDF must be no larger than 10 MB" }, { status: 413 })
      try {
        const content = await readTextbookPdf(bytes)
        if (content.pageCount > 100) return NextResponse.json({ error: "Use a PDF of up to 100 pages" }, { status: 400 })
        const result = await extractQuestionsFromText(content.pages.join("\n\n"))
        await del(body.url).catch(() => {})
        return NextResponse.json(result)
      } catch (error) {
        if (error instanceof NoTextError) return NextResponse.json({ needsOcr: true, pageCount: error.pageCount })
        throw error
      }
    }
    const formData = await request.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "PDF file is required" },
        { status: 400 }
      )
    }

    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const text = await extractTextFromPdf(buffer)
    const result = await extractQuestionsFromText(text)

    return NextResponse.json(result)
  } catch (err) {
    captureError("Extract questions error", err, "/api/ai/extract-questions")
    const message =
      err instanceof Error ? err.message : "Failed to extract questions"
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
