import { NextRequest } from "next/server"
import { generationPrincipal } from "./generation-context"
import { isGenerationTask, type GenerationTask } from "./generation-types"
import { getTutorialPreview } from "./tutorial-letter"
import { randomUUID } from "node:crypto"
import { del } from "@vercel/blob"
import { isTextbookBlobUrl } from "./ai/textbook"

type Handler = (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>
const routes: [RegExp, () => Promise<unknown>][] = [
  [/^\/api\/ai\/generate-lesson$/, () => import("@/app/api/ai/generate-lesson/route")],
  [/^\/api\/ai\/generate-questions$/, () => import("@/app/api/ai/generate-questions/route")],
  [/^\/api\/ai\/generate-flashcards$/, () => import("@/app/api/ai/generate-flashcards/route")],
  [/^\/api\/ai\/find-video$/, () => import("@/app/api/ai/find-video/route")],
  [/^\/api\/ai\/extract-questions$/, () => import("@/app/api/ai/extract-questions/route")],
  [/^\/api\/admin\/textbooks\/ocr-pdf-page$/, () => import("@/app/api/admin/textbooks/ocr-pdf-page/route")],
  [/^\/api\/admin\/textbooks\/analyze$/, () => import("@/app/api/admin/textbooks/analyze/route")],
  [/^\/api\/admin\/textbooks\/create$/, () => import("@/app/api/admin/textbooks/create/route")],
  [/^\/api\/admin\/textbooks\/generate-topic$/, () => import("@/app/api/admin/textbooks/generate-topic/route")],
  [/^\/api\/admin\/papers\/read$/, () => import("@/app/api/admin/papers/read/route")],
  [/^\/api\/admin\/papers\/lesson$/, () => import("@/app/api/admin/papers/lesson/route")],
  [/^\/api\/modules\/build$/, () => import("@/app/api/modules/build/route")],
  [/^\/api\/modules\/build\/topic$/, () => import("@/app/api/modules/build/topic/route")],
  [/^\/api\/topics\/([^/?#]+)\/exercises\/generate$/, () => import("@/app/api/topics/[id]/exercises/generate/route")],
  [/^\/api\/topics\/([^/?#]+)\/projects\/generate$/, () => import("@/app/api/topics/[id]/projects/generate/route")],
  [/^\/api\/courses\/([^/?#]+)\/discover$/, () => import("@/app/api/courses/[id]/discover/route")],
  [/^\/api\/courses\/([^/?#]+)\/import-module$/, () => import("@/app/api/courses/[id]/import-module/route")],
  [/^\/api\/admin\/modules\/([^/?#]+)\/tutorial-letter$/, () => import("@/app/api/admin/modules/[id]/tutorial-letter/route")],
  [/^\/api\/admin\/modules\/([^/?#]+)\/recreate-content$/, () => import("@/app/api/admin/modules/[id]/recreate-content/route")],
  [/^\/api\/admin\/modules\/([^/?#]+)\/assignments$/, () => import("@/app/api/admin/modules/[id]/assignments/route")],
]

export function generationFollowups(task: GenerationTask, data: Record<string, unknown>): GenerationTask[] {
  if (task.continueWith === "recreate-lessons") {
    const topics = task.options?.topics as { id: string; title: string }[]
    const next: GenerationTask[] = topics.map(t => ({ path: task.path, label: t.title, body: { action: "draft", topicId: t.id, sources: task.body.sources, assignmentAnalysis: data.analysis } }))
    if (typeof task.options?.referenceIndex === "number" && task.options.referenceIndex >= 0) next.push({ path: task.path, body: { action: "exam", sources: task.body.sources, referenceIndex: task.options.referenceIndex } })
    return next
  }
  if (task.continueWith === "module-topics") {
    const topics = (Array.isArray(data.topics) ? data.topics : Array.isArray(data.chapters) ? (data.chapters as { topics: unknown[] }[]).flatMap(c => c.topics) : []) as { id: string; title: string; theory?: boolean; startPage?: number; endPage?: number }[]
    return topics.map(t => task.body.sources ? {
      path: "/api/modules/build/topic", body: { moduleId: data.moduleId, topicId: t.id, sources: task.body.sources }, label: t.title,
    } : {
      path: "/api/admin/textbooks/generate-topic", label: t.title,
      body: { ...task.options, topicId: t.id, startPage: t.startPage, endPage: t.endPage, flashcards: t.theory === false ? 0 : task.options?.flashcards },
    })
  }
  if (task.continueWith === "assignment-lessons" && Array.isArray(data.matches)) {
    return [...new Set((data.matches as { topicId: string }[]).map(m => m.topicId))].map(topicId => ({ path: task.path, body: { action: "lesson", source: task.body.source, matches: data.matches, topicId } }))
  }
  return []
}

export async function dispatchGeneration(userId: string, task: GenerationTask, previousResults: { task: GenerationTask; data: unknown }[] = []): Promise<{ data: unknown; next: GenerationTask[] }> {
  if (!isGenerationTask(task)) throw new Error("Unsupported generation task")
  if (task.path === "/api/generation/finish-ocr") {
    const original = task.body.original as GenerationTask
    if (!["/api/admin/textbooks/analyze", "/api/admin/papers/read", "/api/ai/extract-questions"].includes(original?.path) || !isTextbookBlobUrl(original.body?.url) || typeof task.body.ocrKey !== "string") throw new Error("Invalid OCR continuation")
    const rows = previousResults.filter(r => r.task.body.ocrKey === task.body.ocrKey && r.task.path === "/api/admin/textbooks/ocr-pdf-page")
    const pages = rows.map(r => String((r.data as { text: string }).text))
    if (pages.length !== task.body.pageCount) throw new Error("Not every scanned page has been read")
    const result = await dispatchGeneration(userId, { ...original, body: { ...original.body, ocr: { pages } } })
    if (typeof original.body.url === "string") await del(original.body.url).catch(() => {})
    return result
  }
  const entry = routes.find(([pattern]) => pattern.test(task.path))
  if (!entry) throw new Error("Unsupported generation task")
  const id = task.path.match(entry[0])?.[1] ?? ""
  return generationPrincipal.run(userId, async () => {
    if (task.body.action === "draft-all" && task.path.endsWith("/tutorial-letter")) {
      const preview = await getTutorialPreview(id)
      if (!preview || preview.id !== task.body.importId || preview.applied) throw new Error("Choose the current, unapplied tutorial-letter draft")
      return { data: preview, next: preview.tasks.filter(t => !t.complete).map(t => ({ path: task.path, label: t.title, body: { action: "draft", importId: preview.id, key: t.key } })) }
    }
    const route = await entry[1]() as { POST: Handler }
    const response = await route.POST(new NextRequest(`http://generation.internal${task.path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(task.body) }), { params: Promise.resolve({ id }) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? `Generation failed (${response.status})`)
    if (data.needsOcr && typeof task.body.url === "string") {
      if (!Number.isInteger(data.pageCount) || data.pageCount < 1 || data.pageCount > 1000) throw new Error("Split this scanned PDF into shorter documents")
      const ocrKey = randomUUID()
      return { data, next: [
        ...Array.from({ length: data.pageCount }, (_, i) => ({ path: "/api/admin/textbooks/ocr-pdf-page", label: `Read scanned page ${i + 1}`, body: { url: task.body.url, page: i + 1, ocrKey } })),
        { path: "/api/generation/finish-ocr", label: "Prepare the scanned document", body: { original: task, ocrKey, pageCount: data.pageCount } },
      ] }
    }
    return { data, next: generationFollowups(task, data) }
  })
}
