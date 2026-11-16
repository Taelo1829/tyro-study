import { extractRawText } from "mammoth"

/** Extract text only: never render uploaded Word HTML or fetch linked resources. */
export async function readWordPaper(buffer: Buffer): Promise<string> {
  if (buffer.length > 20 * 1024 * 1024) throw new Error("This Word document is too large. Upload a file under 20 MB.")
  let text: string
  try {
    text = (await extractRawText({ buffer })).value.trim()
  } catch {
    throw new Error("Couldn't read this Word document. Save it as .docx or PDF and upload it again.")
  }
  if (text.length < 21) throw new Error("No readable text was found in this Word document. For scanned pages or images, export it as PDF and upload that instead.")
  if (text.length > 250_000) throw new Error("This Word document is too long for a question paper. Split it into smaller documents.")
  return text
}
