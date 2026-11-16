"use client"
import { isGenerationTask, type GenerationJob, type GenerationTask } from "./generation-types"

export async function queueGeneration(tasks: GenerationTask[], title = "Content generation") {
  const response = await fetch("/api/generation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, tasks }) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || "Could not start generation")
  window.dispatchEvent(new CustomEvent("generation-queued", { detail: data.id }))
  return data.id as string
}
export async function waitForGeneration(id: string): Promise<GenerationJob> {
  while (true) {
    const response = await fetch(`/api/generation?id=${encodeURIComponent(id)}`, { cache: "no-store" })
    if (!response.ok) throw new Error("Generation continues in the background. Check Generation activity for its result.")
    const job = await response.json() as GenerationJob | null
    if (!job) throw new Error("Generation job not found")
    if (job.status === "FAILED") throw new Error(job.error || "Generation failed. Check Generation activity.")
    if (job.status === "COMPLETED") return job
    await new Promise(resolve => setTimeout(resolve, 3000))
  }
}

/** Preserve existing editor responses while executing supported JSON work durably. */
export async function generationFetch(path: string, init?: RequestInit): Promise<Response> {
  if (init?.method !== "POST" || typeof init.body !== "string") return fetch(path, init)
  let body: Record<string, unknown>
  try { body = JSON.parse(init.body) } catch { return fetch(path, init) }
  const task = { path, body }
  if (!isGenerationTask(task)) return fetch(path, init)
  const restored = sessionStorage.getItem("generation-restore")
  if (restored) {
    try {
      const saved = JSON.parse(restored)
      const scope = ["topicId", "chapterId", "moduleId", "action", "importId", "key"]
      if (saved.task.path === path && scope.every(key => saved.task.body[key] === body[key])) {
        sessionStorage.removeItem("generation-restore")
        return Response.json(saved.data)
      }
    } catch { sessionStorage.removeItem("generation-restore") }
  }
  const id = await queueGeneration([task], path.includes("questions") ? "Question generation" : path.includes("lesson") ? "Lesson generation" : "Content generation")
  const job = await waitForGeneration(id)
  const result = job.results.find(r => r.task.path === "/api/generation/finish-ocr") ?? job.results[0]
  return Response.json(result.data)
}
