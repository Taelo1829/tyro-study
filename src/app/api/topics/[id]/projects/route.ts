import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { requireAuth } from "@/lib/auth-session"
import { getTopicLock, lockedResponseBody } from "@/lib/topic-locks"
import { bestScores, createProject, getTopicCoding, listProjects } from "@/lib/coding"
import { CODING_LANGUAGES, type CodingLanguage } from "@/lib/coding-shared"
import { normaliseRubric } from "@/lib/ai/projects"

type Params = { params: Promise<{ id: string }> }

/** GET → { coding, projects } with the student's best score on each */
export async function GET(_request: Request, { params }: Params) {
  const { error, session } = await requireAuth()
  if (error) return error
  const { id } = await params
  const isAdmin = session?.user?.role === "ADMIN"
  if (!isAdmin && session?.user?.id) {
    const lock = await getTopicLock(session.user.id, id)
    if (lock) return NextResponse.json(lockedResponseBody(lock), { status: 403 })
  }

  const coding = await getTopicCoding(id)
  if (!coding) return NextResponse.json({ error: "Topic not found" }, { status: 404 })
  const projects = await listProjects(id)
  const scores = await bestScores(projects.map(p => p.id), session!.user.id)
  return NextResponse.json({
    coding: { language: coding.language, auto: coding.auto },
    projects: projects.map(p => ({
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      language: p.language,
      best: scores.get(p.id)?.best ?? null,
      tries: scores.get(p.id)?.tries ?? 0,
    })),
  })
}

/** POST { title, brief, starterCode?, rubric?, difficulty? } - an admin writes a project by hand */
export async function POST(request: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error
  const { id } = await params
  const coding = await getTopicCoding(id)
  if (!coding) return NextResponse.json({ error: "Topic not found" }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const title = String(body.title ?? "").trim().slice(0, 150)
  const brief = String(body.brief ?? "").trim()
  if (!title || !brief) return NextResponse.json({ error: "A title and a brief are needed" }, { status: 400 })
  const language = (typeof body.language === "string" && body.language in CODING_LANGUAGES ? body.language : coding.language ?? "cpp") as CodingLanguage
  // Plain-text briefs are kept readable: paragraphs from blank lines
  const briefHtml = /<[a-z][\s\S]*>/i.test(brief)
    ? brief
    : brief.split(/\n{2,}/).map(p => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`).join("")

  const projectId = await createProject(id, {
    title,
    brief: briefHtml,
    language,
    starterCode: typeof body.starterCode === "string" && body.starterCode.trim() ? body.starterCode : null,
    rubric: normaliseRubric(body.rubric),
    difficulty: ["easy", "medium", "hard"].includes(String(body.difficulty)) ? String(body.difficulty) : "medium",
  })
  return NextResponse.json({ id: projectId }, { status: 201 })
}
