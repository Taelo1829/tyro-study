import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { addModuleToCourse, getCourse } from "@/lib/courses"
import { codeOfModuleTitle, isUnisaUrl, outlineModule, readUnisaPage } from "@/lib/ai/course-import"

/**
 * POST { code, title, year?, url? }
 *
 * Adds one module to the course. If Tyro already has a module with this code
 * it's just added to the course (its content is left alone). Otherwise the
 * module is created with AI-planned chapters and topics (empty for now: their
 * lessons, quizzes and flashcards are written next, one topic at a time).
 * Topics come back with `theory`, which decides who gets flashcards.
 */

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireAdmin()
    if (error) return error

    const course = await getCourse((await params).id)
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const code = String(body.code ?? "").replace(/\s+/g, "").toUpperCase()
    const title = String(body.title ?? "").replace(/\s+/g, " ").trim().slice(0, 150)
    if (!/^[A-Z]{3,4}\d{4}$/.test(code) || !title) {
      return NextResponse.json({ error: "A module code (e.g. COS1511) and name are needed" }, { status: 400 })
    }
    const year = Number(body.year) >= 1 && Number(body.year) <= 4 ? Math.floor(Number(body.year)) : Number(code.match(/\d/)![0]) || 1

    // Already in Tyro: just put it in the course
    const all = await prisma.module.findMany({ select: { id: true, title: true } })
    const existing = all.find(m => codeOfModuleTitle(m.title) === code)
    if (existing) {
      await addModuleToCourse(course.id, existing.id)
      return NextResponse.json({ moduleId: existing.id, title: existing.title, created: false, topics: [] })
    }

    // New: read its UNISA page (best effort) and plan it
    let pageText: string | null = null
    if (isUnisaUrl(body.url)) {
      pageText = await readUnisaPage(body.url).catch(err => {
        console.warn("Module page unreadable:", code, err instanceof Error ? err.message : err)
        return null
      })
    }
    const outline = await outlineModule({ code, title, year, courseTitle: course.title, pageText })

    // Created step by step rather than in one transaction: a long transaction
    // times out on a distant database. If anything fails, the half-made module
    // is deleted (chapters and topics go with it), so a retry starts clean.
    const mod = await prisma.module.create({
      data: { title: `${code} - ${title}`, description: outline.description || null },
      select: { id: true, title: true },
    })
    const topics: { id: string; title: string; theory: boolean; chapter: string }[] = []
    try {
      for (const [ci, chapter] of outline.chapters.entries()) {
        const ch = await prisma.chapter.create({ data: { moduleId: mod.id, title: chapter.title, order: ci }, select: { id: true } })
        const rows = await prisma.topic.createManyAndReturn({
          data: chapter.topics.map((t, ti) => ({ chapterId: ch.id, title: t.title, order: ti })),
          select: { id: true, order: true },
        })
        for (const row of [...rows].sort((a, b) => a.order - b.order)) {
          const t = chapter.topics[row.order]
          topics.push({ id: row.id, title: t.title, theory: t.theory, chapter: `${ci + 1}.${row.order + 1}` })
        }
      }
      await addModuleToCourse(course.id, mod.id)
    } catch (err) {
      await prisma.module.delete({ where: { id: mod.id } }).catch(() => {})
      throw err
    }
    const created = { mod, topics }

    return NextResponse.json({
      moduleId: created.mod.id,
      title: created.mod.title,
      created: true,
      chapters: outline.chapters.length,
      topics: created.topics,
    })
  } catch (err) {
    console.error("Course module import error:", err)
    const message = err instanceof Error ? err.message : "Couldn't add this module"
    return NextResponse.json({ error: message }, { status: message.includes("OPENAI_API_KEY") ? 503 : 500 })
  }
}
