import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-session"
import { getTopicLock, lockedResponseBody } from "@/lib/topic-locks"
import { getProject, saveSubmission, submissionsToday } from "@/lib/coding"
import { MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES, SUBMISSIONS_PER_DAY, UPLOAD_EXTENSIONS, extensionOf } from "@/lib/coding-shared"
import { markSubmission, topicHeader } from "@/lib/ai/projects"

export const runtime = "nodejs"
export const maxDuration = 120

/**
 * POST multipart/form-data with one or more `files` - the student's source
 * files for the project. The AI marks them against the rubric straight away;
 * the submission and its marks are saved and returned.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireAuth()
    if (error) return error
    const userId = session!.user.id

    const project = await getProject((await params).id)
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    if (session?.user?.role !== "ADMIN") {
      const lock = await getTopicLock(userId, project.topicId)
      if (lock) return NextResponse.json(lockedResponseBody(lock), { status: 403 })
    }
    if ((await submissionsToday(project.id, userId)) >= SUBMISSIONS_PER_DAY) {
      return NextResponse.json({ error: `You can submit this project ${SUBMISSIONS_PER_DAY} times a day. Try again tomorrow.` }, { status: 429 })
    }

    const form = await request.formData().catch(() => null)
    const uploads = (form?.getAll("files") ?? []).filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f)
    if (uploads.length === 0) return NextResponse.json({ error: "Choose your code files to upload" }, { status: 400 })
    if (uploads.length > MAX_FILES) return NextResponse.json({ error: `Upload at most ${MAX_FILES} files` }, { status: 400 })

    let total = 0
    const files: { name: string; content: string }[] = []
    for (const f of uploads) {
      const name = f.name.replace(/[\\/]/g, "_").slice(0, 120) || "file"
      if (!UPLOAD_EXTENSIONS.includes(extensionOf(name))) {
        return NextResponse.json({ error: `${name}: that kind of file can't be uploaded. Upload source files (${UPLOAD_EXTENSIONS.join(", ")}).` }, { status: 400 })
      }
      if (f.size > MAX_FILE_BYTES) return NextResponse.json({ error: `${name} is too big (max ${MAX_FILE_BYTES / 1024} KB per file)` }, { status: 400 })
      total += f.size
      const content = Buffer.from(await f.arrayBuffer()).toString("utf8")
      if (content.includes("\u0000")) return NextResponse.json({ error: `${name} isn't a text file` }, { status: 400 })
      files.push({ name, content: content.replace(/\r\n/g, "\n") })
    }
    if (total > MAX_TOTAL_BYTES) return NextResponse.json({ error: `The files are too big together (max ${MAX_TOTAL_BYTES / 1024} KB)` }, { status: 400 })
    if (files.every(f => !f.content.trim())) return NextResponse.json({ error: "The files are empty" }, { status: 400 })

    const info = await topicHeader(project.topicId)
    const { score, feedback } = await markSubmission({ header: info?.header ?? [], project, files })
    const id = await saveSubmission(project.id, userId, files, score, feedback)

    return NextResponse.json({ submission: { id, score, feedback, files, createdAt: new Date() } })
  } catch (err) {
    console.error("Project submission error:", err)
    const message = err instanceof Error ? err.message : "Couldn't mark your project"
    return NextResponse.json({ error: message }, { status: message.includes("OPENAI_API_KEY") ? 503 : 500 })
  }
}
