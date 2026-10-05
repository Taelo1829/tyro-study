import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { getCourse } from "@/lib/courses"
import { codeOfModuleTitle, discoverModules, isUnisaUrl } from "@/lib/ai/course-import"

/**
 * POST { url? } → the course's modules, found on its UNISA qualification page
 * (or suggested by the AI from the course name when no link is given).
 * Each module says whether Tyro already has it and whether it's in this course.
 */

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireAdmin()
    if (error) return error

    const course = await getCourse((await params).id)
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 })

    const body = (await request.json().catch(() => ({}))) as { url?: unknown }
    const url = typeof body.url === "string" && body.url.trim() ? body.url.trim() : null
    if (url && !isUnisaUrl(url)) {
      return NextResponse.json({ error: "Paste a link to the qualification's page on www.unisa.ac.za" }, { status: 400 })
    }

    const found = await discoverModules({ courseTitle: course.title, courseDescription: course.description, url })
    if (found.modules.length === 0) {
      return NextResponse.json(
        { error: url ? "No modules were found on that page. Check it's the qualification's page (the one listing its modules)." : "The AI couldn't list this course's modules. Paste the UNISA qualification link instead." },
        { status: 422 }
      )
    }

    // Which of these does Tyro already have? Matched on the code at the start of the module's name.
    const existing = await prisma.module.findMany({ select: { id: true, title: true } })
    const byCode = new Map<string, { id: string; title: string }>()
    for (const m of existing) {
      const code = codeOfModuleTitle(m.title)
      if (code && !byCode.has(code)) byCode.set(code, m)
    }
    const inCourse = new Set(course.moduleIds)

    return NextResponse.json({
      qualification: found.qualification,
      source: found.source,
      modules: found.modules.map(m => {
        const have = byCode.get(m.code)
        return { ...m, existingModuleId: have?.id ?? null, existingTitle: have?.title ?? null, inCourse: !!have && inCourse.has(have.id) }
      }),
    })
  } catch (err) {
    console.error("Course discover error:", err)
    const message = err instanceof Error ? err.message : "Couldn't find the modules"
    return NextResponse.json({ error: message }, { status: message.includes("OPENAI_API_KEY") ? 503 : 500 })
  }
}
