/**
 * pdf-parse v2 exposes a `PDFParse` class (no default export function).
 *
 * It is loaded lazily, only when a PDF is actually read. pdf-parse pulls in a
 * native module (@napi-rs/canvas); if that can't load on the server (a known
 * problem on Vercel), a top-level import crashes every route that imports this
 * file *before* its error handling runs - the request just dies with an HTML
 * 500. Loading it here, inside the call, turns that into a normal error the
 * caller can catch (and the AI routes simply skip the PDFs).
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // pdf-parse's documented Next.js/Vercel setup: load its worker entry first
  // (it sets up the canvas/DOMMatrix support pdf.js needs on a server), then
  // hand its CanvasFactory to the parser.
  const { CanvasFactory } = await import("pdf-parse/worker")
  const { PDFParse } = await import("pdf-parse")
  const parser = new PDFParse({ data: buffer, CanvasFactory })
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
