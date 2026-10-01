import { PDFParse } from "pdf-parse"

/**
 * pdf-parse v2 no longer has a default export function — it exposes a
 * `PDFParse` class instead. The old `(await import("pdf-parse")).default(buffer)`
 * call was `undefined(...)`, so every PDF upload/extraction threw.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    const text = result.text?.trim() ?? ""
    if (!text) {
      throw new Error("No text could be extracted from this PDF")
    }
    return text.slice(0, 100_000)
  } finally {
    await parser.destroy()
  }
}
