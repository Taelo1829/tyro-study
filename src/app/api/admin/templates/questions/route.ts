import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { buildQuestionsTemplate } from "@/lib/excel/questions"

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const buffer = buildQuestionsTemplate()

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="tyro-questions-template.xlsx"',
    },
  })
}
