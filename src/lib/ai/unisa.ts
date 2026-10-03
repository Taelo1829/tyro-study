import { extractTextFromPdf } from "./pdf-parser"

/**
 * Shared context for AI features. Every module in Tyro Study is a UNISA
 * (University of South Africa) module, so lessons and questions are written
 * with UNISA's distance-learning students in mind.
 */

export const UNISA_CONTEXT = `About the students and context (keep this in mind throughout):
- UNISA (the University of South Africa) is a distance-learning (ODeL) university. Students mostly study on their own, often part-time while working, so material must stand on its own without a lecturer to fill gaps.
- Many students study in their second or third language. Use clear, plain academic English with short sentences, and avoid idioms and slang.
- Never use the em dash character (—). Use a comma, colon, full stop or brackets instead.
- Use South African English spelling (e.g. "organise", "colour", "programme" for a study programme) and, where examples need a setting, South African contexts (rand amounts, local businesses, places, data).
- Match the level to the module: UNISA module codes encode the year level in the first digit (e.g. COS1511 is first-year, NQF 5; a 2xxx code is second-year; 3xxx third-year).
- Align with what a UNISA study guide for this module would cover, but do NOT invent UNISA-specific facts: no tutorial letter numbers, assignment numbers, due dates, page numbers, lecturer names or "as per your study guide" references you cannot know.
- For programming modules (e.g. COS codes), use C++ unless the module clearly uses another language.`

/** "COS1511 Introduction to Programming I" → { code: "COS1511", year: 1 } */
export function moduleCode(title: string) {
  const match = title.match(/\b([A-Z]{3,4})\s?(\d{4})\b/)
  if (!match) return null
  return { code: `${match[1]}${match[2]}`, year: Number(match[2][0]) }
}

/** Lines describing the module for a prompt */
export function moduleLines(mod: { title: string; description: string | null }) {
  const code = moduleCode(mod.title)
  return [
    `UNISA module: ${mod.title}`,
    code ? `Module code: ${code.code} (year level ${code.year})` : "Module code: not given. Infer the level from the title.",
    mod.description ? `Module description: ${mod.description}` : "",
  ].filter(Boolean)
}

/** Download and read uploaded PDFs, up to `limit` characters in total. Unreadable files are skipped. */
export async function readPdfText(pdfs: { title: string; url: string }[], limit: number): Promise<string> {
  let text = ""
  for (const pdf of pdfs) {
    if (text.length >= limit) break
    try {
      const res = await fetch(pdf.url)
      if (!res.ok) continue
      const pdfText = await extractTextFromPdf(Buffer.from(await res.arrayBuffer()))
      text += `\n\n--- ${pdf.title} ---\n${pdfText}`
    } catch (err) {
      console.warn("AI: could not read PDF", pdf.title, err)
    }
  }
  return text.slice(0, limit).trim()
}

/** Lesson HTML → plain text for prompts */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return ""
  return html
    .replace(/<(br|\/p|\/h[1-6]|\/li|\/tr|\/div|\/pre)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
}
