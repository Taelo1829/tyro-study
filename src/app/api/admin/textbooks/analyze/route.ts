import { NextResponse } from "next/server"
import { del, put } from "@vercel/blob"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { TEXTBOOK_PREFIX, isTextbookBlobUrl, proposeOutline, readTextbookPdf } from "@/lib/ai/textbook"

/**
 * POST { moduleId, url } → { pagesUrl, pageCount, chapters }
 * (chapters the module already has come back with their existingChapterId)
 *
 * Reads the uploaded textbook, saves its page text for the next steps, deletes
 * the PDF, and proposes chapters and topics (with page ranges) for the admin
 * to review. Nothing is added to the module yet.
 */

export const runtime = "nodejs"
export const maxDuration = 300

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

export async function POST(request: Request) {
  let pdfUrl: string | null = null
  try {
    const { error } = await requireAdmin()
    if (error) return error

    const body = (await request.json().catch(() => ({}))) as { moduleId?: unknown; url?: unknown }
    if (typeof body.moduleId !== "string" || !isTextbookBlobUrl(body.url)) {
      return NextResponse.json({ error: "Upload the textbook first" }, { status: 400 })
    }
    pdfUrl = body.url

    const mod = await prisma.module.findUnique({
      where: { id: body.moduleId },
      select: { title: true, description: true, chapters: { select: { id: true, title: true, topics: { select: { title: true } } } } },
    })
    if (!mod) return NextResponse.json({ error: "Module not found" }, { status: 404 })

    const res = await fetch(pdfUrl)
    if (!res.ok) return NextResponse.json({ error: "Couldn't download the uploaded textbook. Upload it again." }, { status: 410 })
    const data = await readTextbookPdf(Buffer.from(await res.arrayBuffer()))

    const saved = await put(`${TEXTBOOK_PREFIX}pages/${crypto.randomUUID()}.json`, JSON.stringify(data), {
      access: "public",
      contentType: "application/json",
    })
    // The page text is all the next steps need
    await del(pdfUrl).catch(err => console.warn("Textbook: could not delete PDF", err))
    pdfUrl = null

    const chapters = await proposeOutline(data, mod)
    if (chapters.length === 0) {
      return NextResponse.json({ error: "Couldn't find chapters in this textbook. Is it a full textbook with headings?" }, { status: 422 })
    }

    // Flag chapters/topics the module already has, so they aren't added twice.
    // New topics for a chapter the module already has go into that chapter.
    const existingChapters = new Map(mod.chapters.map(c => [normalise(c.title), c.id]))
    const existingTopics = new Set(mod.chapters.flatMap(c => c.topics.map(t => normalise(t.title))))

    return NextResponse.json({
      pagesUrl: saved.url,
      pageCount: data.pageCount,
      chapters: chapters.map(c => ({
        ...c,
        existingChapterId: existingChapters.get(normalise(c.title)) ?? null,
        topics: c.topics.map(t => ({ ...t, exists: existingTopics.has(normalise(t.title)) })),
      })),
    })
  } catch (err) {
    console.error("Textbook analyse error:", err)
    if (pdfUrl) await del(pdfUrl).catch(() => {})
    const message = err instanceof Error ? err.message : "Couldn't read the textbook"
    return NextResponse.json({ error: message }, { status: message.includes("OPENAI_API_KEY") ? 503 : 500 })
  }
}
