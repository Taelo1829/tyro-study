export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default
  const data = await pdfParse(buffer)
  const text = data.text?.trim() ?? ""
  if (!text) {
    throw new Error("No text could be extracted from this PDF")
  }
  return text.slice(0, 100_000)
}
