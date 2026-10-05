import { NextResponse } from "next/server"
import { del } from "@vercel/blob"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { NoTextError, isTextbookBlobUrl, readTextbookPdf, textbookFromOcr } from "@/lib/ai/textbook"
import { questionsFromPaper } from "@/lib/ai/papers"

/**
 * POST { moduleId, url } or { moduleId, ocr: { pages } } (a scanned paper read
 * in the browser) → { paper, questions, topics }
 *
 * Reads an uploaded question paper, deletes the PDF, and has the AI turn its
 * questions into multiple-choice questions matched to the module's topics.
 * Nothing is saved yet: the admin reviews them first. A PDF with no
 * selectable text answers { needsOcr: true, pageCount }.
 */

export const runtime = "nodejs"
export const maxDuration = 300

const MAX_PAPER_PAGES = 80

export async function POST(request: Request) {
  let pdfUrl: string | null = null
  try {
    const { error } = await requireAdmin()
    if (error) return error

    const body = (await request.json().catch(() => ({}))) as { moduleId?: unknown; url?: unknown; ocr?: { pages?: unknown } }
    const fromOcr = !!body.ocr && Array.isArray(body.ocr.pages)
    if (typeof body.moduleId !== "string" || (!fromOcr && !isTextbookBlobUrl(body.url))) {
      return NextResponse.json({ error: "Upload the question paper first" }, { status: 400 })
    }
    if (!fromOcr) pdfUrl = body.url as string

    const mod = await prisma.module.findUnique({
      where: { id: body.moduleId },
      select: {
        title: true,
        description: true,
        chapters: { orderBy: { order: "asc" }, select: { title: true, topics: { orderBy: { order: "asc" }, select: { id: true, title: true } } } },
      },
    })
    if (!mod) return NextResponse.json({ error: "Module not found" }, { status: 404 })
    const topics = mod.chapters.flatMap((c, ci) => c.topics.map((t, ti) => ({ id: t.id, label: `${ci + 1}.${ti + 1} ${c.title} / ${t.title}` })))
    if (topics.length === 0) return NextResponse.json({ error: "Add this module's chapters and topics first, so the questions have somewhere to go." }, { status: 422 })

    let pages: string[]
    if (fromOcr) {
      pages = textbookFromOcr(body.ocr!).pages
    } else {
      const res = await fetch(pdfUrl!)
      if (!res.ok) return NextResponse.json({ error: "Couldn't download the uploaded paper. Upload it again." }, { status: 410 })
      try {
        pages = (await readTextbookPdf(Buffer.from(await res.arrayBuffer()))).pages
      } catch (err) {
        if (!(err instanceof NoTextError)) throw err
        await del(pdfUrl!).catch(() => {})
        pdfUrl = null
        return NextResponse.json({ needsOcr: true, pageCount: err.pageCount })
      }
      await del(pdfUrl!).catch(() => {})
      pdfUrl = null
    }
    if (pages.length > MAX_PAPER_PAGES) {
      return NextResponse.json({ error: `That's ${pages.length} pages. A question paper should be under ${MAX_PAPER_PAGES} pages: is this a textbook? Use Upload textbook for that.` }, { status: 422 })
    }
    if (!pages.some(p => p.trim().length > 20)) return NextResponse.json({ error: "No text could be read from the paper." }, { status: 422 })

    const result = await questionsFromPaper({ pages, module: mod, topics })
    if (result.questions.length === 0) {
      return NextResponse.json({ error: "No questions were found in that PDF. Is it a question paper?" }, { status: 422 })
    }
    return NextResponse.json({ ...result, topics })
  } catch (err) {
    console.error("Question paper read error:", err)
    if (pdfUrl) await del(pdfUrl).catch(() => {})
    const message = err instanceof Error ? err.message : "Couldn't read the paper"
    return NextResponse.json({ error: message }, { status: message.includes("OPENAI_API_KEY") ? 503 : 500 })
  }
}
