import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { put } from "@vercel/blob"
import { getServerSession } from "next-auth"
import { requireAdmin } from "@/lib/admin"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ id: string }> }

interface TopicPdfRow {
  id: string
  topicId: string
  title: string
  url: string
  pathname: string | null
  createdAt: Date
}

const MAX_PDF_SIZE = 25 * 1024 * 1024

function safeFileName(name: string) {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

async function canReadTopicPdfs(topicId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return false

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })

  if (user?.role === "ADMIN") return true

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { chapter: { select: { moduleId: true } } },
  })

  if (!topic) return false

  const enrollment = await prisma.moduleEnrollment.findUnique({
    where: {
      userId_moduleId: {
        userId: session.user.id,
        moduleId: topic.chapter.moduleId,
      },
    },
    select: { id: true },
  })

  return Boolean(enrollment)
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params

  if (!(await canReadTopicPdfs(id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const pdfs = await prisma.$queryRaw<TopicPdfRow[]>`
    SELECT "id", "topicId", "title", "url", "pathname", "createdAt"
    FROM "topic_pdfs"
    WHERE "topicId" = ${id}
    ORDER BY "createdAt" ASC
  `

  return NextResponse.json(pdfs)
}

export async function POST(request: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const topic = await prisma.topic.findUnique({ where: { id }, select: { id: true } })
  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 })
  }

  const formData = await request.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "PDF file is required" }, { status: 400 })
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 })
  }

  if (file.size > MAX_PDF_SIZE) {
    return NextResponse.json({ error: "PDF must be 25MB or smaller" }, { status: 400 })
  }

  const title = safeFileName(file.name) || "topic-pdf"
  const pathname = `topic-pdfs/${id}/${Date.now()}-${title}.pdf`
  const pdfId = randomUUID()
  const blob = await put(pathname, file, {
    access: "public",
    contentType: "application/pdf",
  })

  const [pdf] = await prisma.$queryRaw<TopicPdfRow[]>`
    INSERT INTO "topic_pdfs" ("id", "topicId", "title", "url", "pathname")
    VALUES (${pdfId}, ${id}, ${file.name}, ${blob.url}, ${blob.pathname})
    RETURNING "id", "topicId", "title", "url", "pathname", "createdAt"
  `

  return NextResponse.json(pdf, { status: 201 })
}
