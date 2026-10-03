import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

/**
 * POST { moduleId, chapters: [{ title, chapterId?, topics: [{ title, startPage, endPage }] }] }
 *
 * Adds the reviewed chapters and topics to the end of the module (empty for
 * now; their lessons and quizzes are written next, one topic at a time).
 * With a chapterId, the topics go at the end of that existing chapter instead
 * of a new chapter. Each created topic comes back with its "1.2" number.
 */

interface TopicInput {
  title: string
  startPage: number
  endPage: number
}

const MAX_CHAPTERS = 60
const MAX_TOPICS = 400

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = (await request.json().catch(() => ({}))) as { moduleId?: unknown; chapters?: unknown }
  if (typeof body.moduleId !== "string") return NextResponse.json({ error: "moduleId is required" }, { status: 400 })

  const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 150)
  const chapters = (Array.isArray(body.chapters) ? body.chapters : [])
    .map((c: Record<string, unknown>) => ({
      title: clean(c?.title),
      chapterId: typeof c?.chapterId === "string" ? c.chapterId : null,
      topics: (Array.isArray(c?.topics) ? c.topics : [])
        .map((t: Record<string, unknown>): TopicInput => ({
          title: clean(t?.title),
          startPage: Math.max(1, Math.floor(Number(t?.startPage) || 1)),
          endPage: Math.max(1, Math.floor(Number(t?.endPage) || 1)),
        }))
        .filter(t => t.title),
    }))
    .filter(c => c.title && c.topics.length > 0)

  if (chapters.length === 0) return NextResponse.json({ error: "Choose at least one topic" }, { status: 400 })
  if (chapters.length > MAX_CHAPTERS || chapters.reduce((n, c) => n + c.topics.length, 0) > MAX_TOPICS) {
    return NextResponse.json({ error: "That's too much for one import. Import part of the book at a time." }, { status: 400 })
  }

  const mod = await prisma.module.findUnique({
    where: { id: body.moduleId },
    select: {
      id: true,
      chapters: { select: { id: true, order: true, topics: { select: { order: true }, orderBy: { order: "desc" }, take: 1 } } },
    },
  })
  if (!mod) return NextResponse.json({ error: "Module not found" }, { status: 404 })
  const existing = new Map(mod.chapters.map(c => [c.id, c]))
  if (chapters.some(c => c.chapterId && !existing.has(c.chapterId))) {
    return NextResponse.json({ error: "That chapter isn't in this module any more. Reload and try again." }, { status: 409 })
  }
  let nextOrder = Math.max(-1, ...mod.chapters.map(c => c.order)) + 1

  const created = await prisma.$transaction(
    async tx => {
      const out = []
      for (const chapter of chapters) {
        const current = chapter.chapterId ? existing.get(chapter.chapterId)! : null
        const row = current
          ? await tx.chapter.findUniqueOrThrow({ where: { id: current.id }, select: { id: true, title: true } })
          : await tx.chapter.create({
              data: { moduleId: mod.id, title: chapter.title, order: nextOrder++ },
              select: { id: true, title: true },
            })
        const firstTopicOrder = current ? (current.topics[0]?.order ?? -1) + 1 : 0
        const topics = []
        for (const [ti, topic] of chapter.topics.entries()) {
          const t = await tx.topic.create({
            data: { chapterId: row.id, title: topic.title, order: firstTopicOrder + ti },
            select: { id: true, title: true },
          })
          topics.push({ ...t, startPage: topic.startPage, endPage: Math.max(topic.startPage, topic.endPage) })
        }
        out.push({ ...row, topics })
      }
      return out
    },
    { timeout: 30_000, maxWait: 10_000 }
  )

  // "1.2"-style numbers as students see them (chapter position, topic position)
  const layout = await prisma.chapter.findMany({
    where: { moduleId: mod.id },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, topics: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true } } },
  })
  const numbers = new Map(layout.flatMap((c, ci) => c.topics.map((t, ti) => [t.id, `${ci + 1}.${ti + 1}`] as const)))

  return NextResponse.json(
    {
      chapters: created.map(c => ({ ...c, topics: c.topics.map(t => ({ ...t, number: numbers.get(t.id) ?? "" })) })),
    },
    { status: 201 }
  )
}
