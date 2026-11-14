"use client"

import { MAX_PAPER_BYTES, type PaperSource } from "@/lib/module-recreation-input"
import { paperPageText } from "@/lib/paper-page-text"
import { ocrScannedPdf } from "./pdf-ocr"

export async function readPaperFile(file: File, onProgress: (message: string) => void): Promise<PaperSource> {
  if (!/\.pdf$/i.test(file.name) || file.size > MAX_PAPER_BYTES) throw new Error("Choose PDF files up to 10 MB each.")
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: string[] = []
  let needsOcr = false
  try {
    if (doc.numPages > 100) throw new Error(`${file.name} has more than 100 pages. Split it into shorter papers first.`)
    for (let n = 1; n <= doc.numPages; n++) {
      onProgress(`Reading ${file.name}: page ${n} of ${doc.numPages}`)
      const page = await doc.getPage(n)
      const content = await page.getTextContent()
      const text = paperPageText(content.items.filter((item): item is Extract<typeof item, { str: string }> => "str" in item))
      if (text.length < 30) needsOcr = true
      pages.push(text)
      page.cleanup()
    }
  } finally {
    await doc.destroy()
  }
  if (needsOcr) {
    const scanned = await ocrScannedPdf(file, { onProgress: (done, total) => onProgress(`Reading scanned pages in ${file.name}: ${done} of ${total}`) })
    if (scanned.failed) throw new Error(`${file.name}: ${scanned.failed} pages could not be read. Try again or upload a clearer PDF.`)
    scanned.pages.forEach((text, i) => { if (pages[i].length < 30) pages[i] = text })
  }
  const text = pages.map((page, i) => `[Page ${i + 1}]\n${page}`).join("\n\n")
  if (pages.join("").trim().length < 30) throw new Error(`${file.name} has no readable content. Upload a clearer copy.`)
  return { name: file.name, text }
}
