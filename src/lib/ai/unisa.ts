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

const MATHS = "Subscripts: write x_1, x_2, a_{ij}, v_{n+1} (the app shows them as subscripts), never x1 for x with subscript 1. Powers: x^2, e^{-x}. Fractions: 3/4, x/y or (a+b)/(c-d). Matrices: [[1, 2], [3, 4]] (never <matrix> tags). Vectors: (1, 2, 3) or [[1], [2], [3]] for a column. Sums and products with limits: ∑_{k=1}^{n} a_{ik}b_{kj}, ∏_{i=1}^{n} (the app puts the limits above and below). Use ≤ ≥ ≠ × · √ ∑ ∫ λ θ directly."

/** How to write this subject's notation so the app displays it properly */
const NOTATION: [RegExp, string][] = [
  // Mathematics, applied maths, statistics, physics, chemistry, finance maths
  [/^(MAT|APM|MAC|STA|DSC|PHY|CHE|FAC|QMI)/, `Notation (${"this subject"}): ${MATHS}`],
  // Computing: code stays code
  [/^(COS|INF|ICT|CIS|COM)/, "Notation: code stays exactly as written (x1, my_var and a[i] are names, not maths). Put code as plain text with line breaks, never subscripts or superscripts inside code. For maths outside code (e.g. logic, sets, complexity) use x_1 for subscripts, n^2 for powers, a/b for fractions and ∧ ∨ ¬ → ↔ ∀ ∃ ∈ ∪ ∩ directly."],
]

/** The notation guide for a module (by its code), or a general one */
export function notationFor(title: string): string {
  const code = moduleCode(title)?.code ?? ""
  const hit = NOTATION.find(([re]) => re.test(code))
  return hit ? hit[1].replace("this subject", code.slice(0, 3)) : `Notation (where maths appears): ${MATHS}`
}

/** Lines describing the module for a prompt */
export function moduleLines(mod: { title: string; description: string | null }) {
  const code = moduleCode(mod.title)
  return [
    `UNISA module: ${mod.title}`,
    code ? `Module code: ${code.code} (year level ${code.year})` : "Module code: not given. Infer the level from the title.",
    mod.description ? `Module description: ${mod.description}` : "",
    notationFor(mod.title),
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
