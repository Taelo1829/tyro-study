"use client"
import type { WrittenFeedback, SubmissionPage } from "@/lib/written-quiz-types"
import { MAX_WRITTEN_PAGES, MAX_WRITTEN_PAYLOAD } from "@/lib/written-quiz-types"

export async function prepareWrittenPages(files: File[]): Promise<SubmissionPage[]> {
  if (!files.length || files.length > MAX_WRITTEN_PAGES) throw new Error(`Choose up to ${MAX_WRITTEN_PAGES} photos or PDF pages.`)
  const pages: SubmissionPage[] = []
  const add = (canvas: HTMLCanvasElement, label: string) => {
    pages.push({ image: canvas.toDataURL("image/jpeg", 0.82), label: label.slice(0, 255) })
    if (pages.length > MAX_WRITTEN_PAGES) throw new Error(`Submit at most ${MAX_WRITTEN_PAGES} pages per answer.`)
    if (JSON.stringify(pages).length > MAX_WRITTEN_PAYLOAD - 10000) throw new Error("These pages are too large. Upload fewer pages or smaller photos.")
  }
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) throw new Error("Each file must be under 10 MB.")
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      const pdfjs = await import("pdfjs-dist")
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
      try {
        if (pages.length + doc.numPages > MAX_WRITTEN_PAGES) throw new Error(`Submit at most ${MAX_WRITTEN_PAGES} pages per answer.`)
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n)
          const size = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale: 1600 / Math.max(size.width, size.height) })
          const canvas = document.createElement("canvas")
          canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
          await page.render({ canvas, viewport }).promise
          add(canvas, `${file.name} · page ${n}`)
          page.cleanup()
        }
      } finally { await doc.destroy() }
    } else {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose JPG, PNG, WebP photos or a PDF.")
      const bitmap = await createImageBitmap(file)
      try {
        const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
        const canvas = document.createElement("canvas")
        canvas.width = Math.ceil(bitmap.width * scale); canvas.height = Math.ceil(bitmap.height * scale)
        const ctx = canvas.getContext("2d")!
        ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        add(canvas, file.name)
      } finally { bitmap.close() }
    }
  }
  return pages
}

export function WrittenFeedbackView({ feedback }: { feedback: WrittenFeedback }) {
  return <section className="my-4 space-y-3 rounded-xl border border-border bg-card p-4" aria-label="Written answer feedback">
    <p role="status" className="text-lg font-semibold">{feedback.earnedMarks} / {feedback.maxMarks} marks</p>
    <p className="whitespace-pre-wrap">{feedback.summary}</p>
    <ul className="space-y-2">{feedback.criteria.map((c, i) => <li key={i}><p className="font-medium">{c.criterion}: {c.earned} / {c.possible}</p><p className="text-sm">{c.feedback}</p></li>)}</ul>
    <details><summary className="cursor-pointer font-medium">Model answer</summary><p className="mt-2 whitespace-pre-wrap">{feedback.modelAnswer}</p></details>
    <details><summary className="cursor-pointer font-medium">Your answer as read</summary><p className="mt-2 whitespace-pre-wrap">{feedback.transcription}</p></details>
  </section>
}
