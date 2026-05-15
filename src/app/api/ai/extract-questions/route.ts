import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { extractTextFromPdf } from "@/lib/ai/pdf-parser"
import { extractQuestionsFromText } from "@/lib/ai/question-generator"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
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
    console.error("Extract questions error:", err)
    const message =
      err instanceof Error ? err.message : "Failed to extract questions"
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
