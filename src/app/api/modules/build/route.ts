import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { addModuleToCourse } from "@/lib/courses"
import { codeOfModuleTitle, outlineModule, outlineSubject, type ModuleOutline } from "@/lib/ai/course-import"
import { moduleCode } from "@/lib/ai/unisa"
import { HIGH_SCHOOL_GRADES, isStudyLevel } from "@/lib/levels"
import { gradeCourseId, setModuleLevel } from "@/lib/levels-server"

/**
 * POST { level, name, grade?, notes?, courseId? }
 *
 * "Add with AI": from just a subject's or module's name, the AI plans its
 * chapters and topics from the syllabus (CAPS for a Grade 11/12 subject,
 * the UNISA module for a university module) and the module is created with
 * them (topics empty: their lessons, quizzes and flashcards are written next,
 * one topic at a time, by /api/admin/textbooks/generate-topic).
 *
 * High school subjects are named "<Subject> - Grade <n>" and go in that
 * grade. → { moduleId, title, chapters, topics: [{ id, title, theory, chapter }] }
 * If it already exists → 409 { error, moduleId }.
 */

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  try {
    const { error } = await requireAdmin()
    if (error) return error

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const level = isStudyLevel(body.level) ? body.level : null
    const name = String(body.name ?? "").replace(/\s+/g, " ").trim().slice(0, 150)
    const notes = String(body.notes ?? "").trim().slice(0, 1000)
    if (!level || name.length < 2) {
      return NextResponse.json({ error: "Choose high school or university and type the name" }, { status: 400 })
    }

    const existingModules = await prisma.module.findMany({ select: { id: true, title: true } })
    const sameTitle = (title: string) => existingModules.find(m => m.title.trim().toLowerCase() === title.toLowerCase())

    let title: string
    let outline: ModuleOutline
    let courseId: string | null = typeof body.courseId === "string" ? body.courseId : null

    if (level === "highschool") {
      const grade = Number(body.grade)
      if (!HIGH_SCHOOL_GRADES.includes(grade as (typeof HIGH_SCHOOL_GRADES)[number])) {
        return NextResponse.json({ error: "Choose Grade 11 or 12" }, { status: 400 })
      }
      const planned = await outlineSubject({ name, grade, notes })
      title = `${planned.subject} - Grade ${grade}`
      outline = planned
      courseId = await gradeCourseId(grade)
    } else {
      const code = moduleCode(name)
      const rest = code ? name.replace(new RegExp(`\\b${code.code.slice(0, -4)}\\s?${code.code.slice(-4)}\\b`, "i"), "").replace(/^[\s\-–:]+|[\s\-–:]+$/g, "") : name
      title = code ? `${code.code} - ${rest || code.code}` : name
      const existing = code ? existingModules.find(m => codeOfModuleTitle(m.title) === code.code) : sameTitle(title)
      if (existing) {
        return NextResponse.json({ error: `${existing.title} is already in Tyro`, moduleId: existing.id }, { status: 409 })
      }
      outline = await outlineModule({
        code: code?.code ?? "",
        title: rest || name,
        year: code?.year ?? 1,
        courseTitle: notes || "a UNISA qualification",
        pageText: null,
      })
    }

    const existing = sameTitle(title)
    if (existing) return NextResponse.json({ error: `${existing.title} is already in Tyro`, moduleId: existing.id }, { status: 409 })

    // Created step by step (a long transaction times out on a distant
    // database); if anything fails the half-made module is deleted.
    const mod = await prisma.module.create({ data: { title, description: outline.description || null }, select: { id: true, title: true } })
    const topics: { id: string; title: string; theory: boolean; chapter: string }[] = []
    try {
      if (level !== "tertiary") await setModuleLevel(mod.id, level)
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
      if (courseId) await addModuleToCourse(courseId, mod.id)
    } catch (err) {
      await prisma.module.delete({ where: { id: mod.id } }).catch(() => {})
      throw err
    }

    return NextResponse.json({ moduleId: mod.id, title: mod.title, chapters: outline.chapters.length, topics }, { status: 201 })
  } catch (err) {
    console.error("Build module error:", err)
    let message = err instanceof Error ? err.message : "Couldn't plan it"
    if (/column .*level|"level"/i.test(message)) message = "High school subjects need the latest database update: run `npx prisma migrate deploy`."
    return NextResponse.json({ error: message }, { status: /OPENAI_API_KEY|migrate deploy/.test(message) ? 503 : 500 })
  }
}
