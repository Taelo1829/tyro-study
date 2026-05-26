import { NextResponse } from "next/server"
import { del } from "@vercel/blob"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ id: string; pdfId: string }> }

interface TopicPdfRow {
  id: string
  url: string
  pathname: string | null
}

export async function DELETE(_request: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id, pdfId } = await params
  const [pdf] = await prisma.$queryRaw<TopicPdfRow[]>`
    SELECT "id", "url", "pathname"
    FROM "topic_pdfs"
    WHERE "id" = ${pdfId} AND "topicId" = ${id}
    LIMIT 1
  `

  if (!pdf) {
    return NextResponse.json({ error: "PDF not found" }, { status: 404 })
  }

  await prisma.$executeRaw`
    DELETE FROM "topic_pdfs"
    WHERE "id" = ${pdfId} AND "topicId" = ${id}
  `

  if (pdf.pathname || pdf.url) {
    await del(pdf.pathname ?? pdf.url)
  }

  return NextResponse.json({ success: true })
}
