"use client"

/**
 * OCR for scanned textbooks, run from the admin's browser: pdf.js renders
 * each page of the local PDF to a JPEG, and /api/admin/textbooks/ocr has the
 * AI transcribe it. Pages go a few at a time so a big book finishes in
 * minutes, and a page that fails is retried once (then left blank).
 *
 * The pdf.js worker is served from /pdf.worker.min.mjs (copied from
 * node_modules/pdfjs-dist/build; keep it in step with the pdfjs-dist version).
 */

export interface OcrResult {
  pages: string[]
  labels: (string | null)[]
  outline: string[]
  failed: number
}

const CONCURRENCY = 4
/** Longest side of the rendered page, in pixels: sharp enough for small print */
const TARGET_PX = 1700

interface OutlineNode {
  title?: string
  items?: OutlineNode[]
}

export async function ocrScannedPdf(
  file: File,
  {
    onProgress,
    shouldStop,
  }: { onProgress?: (done: number, total: number) => void; shouldStop?: () => boolean } = {}
): Promise<OcrResult> {
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise

  try {
    const total = doc.numPages
    const pages: string[] = Array.from({ length: total }, () => "")

    // Bookmarks and printed page numbers help the AI find the chapters
    let labels: (string | null)[] = pages.map(() => null)
    const outline: string[] = []
    try {
      const raw = await doc.getPageLabels()
      if (raw) labels = pages.map((_, i) => raw[i] ?? null)
      const walk = (items: OutlineNode[] | null | undefined, depth: number) => {
        for (const item of items ?? []) {
          if (outline.length >= 600) return
          if (item.title?.trim()) outline.push(`${"  ".repeat(depth)}${item.title.trim()}`)
          if (depth < 2) walk(item.items, depth + 1)
        }
      }
      walk((await doc.getOutline()) as OutlineNode[] | null, 0)
    } catch {
      // Not every PDF has these
    }

    const renderPage = async (n: number): Promise<string> => {
      const page = await doc.getPage(n)
      const base = page.getViewport({ scale: 1 })
      const scale = Math.min(3, TARGET_PX / Math.max(base.width, base.height))
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement("canvas")
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas isn't available")
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvas, canvasContext: ctx, viewport }).promise
      page.cleanup()
      const url = canvas.toDataURL("image/jpeg", 0.82)
      canvas.width = canvas.height = 0
      return url
    }

    const readPage = async (n: number): Promise<string> => {
      const image = await renderPage(n)
      const res = await fetch("/api/admin/textbooks/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: n, image }),
      })
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? `OCR failed (${res.status})`)
      return data.text ?? ""
    }

    let next = 1
    let done = 0
    let failed = 0
    let fatal: Error | null = null
    const worker = async () => {
      while (next <= total && !fatal && !shouldStop?.()) {
        const n = next++
        try {
          pages[n - 1] = await readPage(n).catch(() => readPage(n))
        } catch (err) {
          failed++
          // Missing API key and the like: no point carrying on
          if (err instanceof Error && /OPENAI_API_KEY|Unauthorized|Forbidden/.test(err.message)) fatal = err
        }
        done++
        onProgress?.(done, total)
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    if (fatal) throw fatal

    return { pages, labels, outline, failed }
  } finally {
    await doc.destroy()
  }
}
