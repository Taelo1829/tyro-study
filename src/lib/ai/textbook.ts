import { chatJson } from "@/lib/ai/openai"
import { moduleLines } from "@/lib/ai/unisa"

/**
 * Textbook import: read a textbook PDF page by page, propose chapters and
 * topics (with the pages each one covers), and hand each topic its pages
 * when its lesson and quiz are written.
 *
 * The admin's browser uploads the PDF straight to Vercel Blob (under
 * "textbooks/"), so large books aren't limited by the 4.5MB request size.
 * After reading, the page text is kept as a small JSON file next to it and
 * the PDF itself is deleted.
 */

export const TEXTBOOK_PREFIX = "textbooks/"
export const MAX_TEXTBOOK_BYTES = 300 * 1024 * 1024

/** Only our own blob files under textbooks/ may be read by the import routes */
export function isTextbookBlobUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname.endsWith(".blob.vercel-storage.com") && url.pathname.startsWith(`/${TEXTBOOK_PREFIX}`)
  } catch {
    return false
  }
}

export interface TextbookData {
  pageCount: number
  /** Text of each page; index 0 is page 1 */
  pages: string[]
  /** The page number printed on each page, when the PDF says (e.g. "xii", "7") */
  labels: (string | null)[]
  /** Bookmark titles, indented by level */
  outline: string[]
}

interface OutlineItem {
  title?: string
  items?: OutlineItem[]
}

/** The PDF has no selectable text (a scanned book): its pages need OCR */
export class NoTextError extends Error {
  constructor(public pageCount: number) {
    super("No text could be read from this PDF.")
  }
}

/** The most pages a scanned book may have for OCR (each page is one AI call) */
export const MAX_OCR_PAGES = 1000

/**
 * Page text read by OCR in the admin's browser (scanned books), checked and
 * tidied into the same shape readTextbookPdf returns.
 */
export function textbookFromOcr(input: { pages?: unknown; labels?: unknown; outline?: unknown }): TextbookData {
  const pages = (Array.isArray(input.pages) ? input.pages : [])
    .slice(0, MAX_OCR_PAGES)
    .map(p => String(p ?? "").replace(/[ \t]+/g, " ").trim().slice(0, 20_000))
  const labels = pages.map((_, i) => {
    const l = Array.isArray(input.labels) ? input.labels[i] : null
    return typeof l === "string" && l.trim() ? l.trim().slice(0, 20) : null
  })
  const outline = (Array.isArray(input.outline) ? input.outline : [])
    .filter((l): l is string => typeof l === "string" && !!l.trim())
    .slice(0, 600)
    .map(l => l.slice(0, 200))
  return { pageCount: pages.length, pages, labels, outline }
}

/** Read every page's text, the printed page numbers and the bookmarks */
export async function readTextbookPdf(buffer: Buffer): Promise<TextbookData> {
  const { CanvasFactory } = await import("pdf-parse/worker")
  const { PDFParse } = await import("pdf-parse")
  const parser = new PDFParse({ data: new Uint8Array(buffer), CanvasFactory })
  try {
    const text = await parser.getText({ pageJoiner: "" })
    const pageCount = text.total
    const pages = Array.from({ length: pageCount }, () => "")
    for (const page of text.pages) {
      if (page.num >= 1 && page.num <= pageCount) pages[page.num - 1] = page.text.replace(/[ \t]+/g, " ").trim()
    }
    if (!pages.some(p => p.length > 20)) {
      throw new NoTextError(pageCount)
    }

    let labels: (string | null)[] = pages.map(() => null)
    let outline: string[] = []
    try {
      const info = await parser.getInfo({ parsePageInfo: true })
      labels = pages.map((_, i) => info.pages?.[i]?.pageLabel ?? null)
      const walk = (items: OutlineItem[] | null | undefined, depth: number) => {
        for (const item of items ?? []) {
          if (outline.length >= 600) return
          if (item.title?.trim()) outline.push(`${"  ".repeat(depth)}${item.title.trim()}`)
          if (depth < 2) walk(item.items, depth + 1)
        }
      }
      walk(info.outline as OutlineItem[] | null, 0)
    } catch (err) {
      console.warn("Textbook: could not read bookmarks/page labels", err)
      outline = []
    }

    return { pageCount, pages, labels, outline }
  } finally {
    await parser.destroy()
  }
}

export interface ProposedTopic {
  title: string
  startPage: number
  endPage: number
}

export interface ProposedChapter {
  title: string
  startPage: number
  endPage: number
  topics: ProposedTopic[]
}

const OUTLINE_PROMPT = `You turn a university textbook into the structure of an online course for UNISA students: chapters, each split into topics. Every topic becomes one lesson and one short quiz, written from the pages it covers.

You get: the textbook's bookmarks (if any), the text of its first pages (usually including the table of contents), and an index of every page with its first lines.

Rules:
- Follow the book's own chapters and sections, in book order.
- Topics are the main sections of a chapter, each big enough for one lesson (usually 3-25 pages). Merge tiny subsections into their section; don't make a topic per sub-subsection. Most chapters have 2-8 topics.
- Leave out front and back matter: cover, title and copyright pages, preface, contents, acknowledgements, index, references/bibliography, answers to exercises, and appendices that are just tables.
- Page numbers: use the PDF page numbers from the index ("p12"), NOT the numbers printed in the book or listed in the table of contents. Where the two differ, find the page in the index whose first lines show the section heading.
- Titles: the book's own heading text, cleaned up: no numbering ("Chapter 3", "2.4"), no trailing page numbers or dot leaders, normal capitalisation.
- startPage is the PDF page where the chapter/topic begins. The first topic of a chapter usually starts on the chapter's first page.
- lastPage is the last PDF page of the book's main content (before the index, references or answer appendices).

Respond with JSON only:
{ "lastPage": 123, "chapters": [ { "title": "…", "startPage": 1, "topics": [ { "title": "…", "startPage": 1 } ] } ] }`

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s)

function pageIndex(data: TextbookData, linesPerPage: number, width: number) {
  return data.pages
    .map((text, i) => {
      const lines = text
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 1)
        .slice(0, linesPerPage)
        .map(l => clip(l, width))
      const label = data.labels[i] && data.labels[i] !== String(i + 1) ? ` (printed ${data.labels[i]})` : ""
      return `p${i + 1}${label}: ${lines.join(" | ") || "(blank)"}`
    })
    .join("\n")
}

/** Ask the AI for the book's chapters and topics, then tidy and check the page ranges */
export async function proposeOutline(data: TextbookData, mod: { title: string; description: string | null }): Promise<ProposedChapter[]> {
  // The page index is the biggest part of the prompt: make it fit long books
  let index = pageIndex(data, 3, 110)
  if (index.length > 90_000) index = pageIndex(data, 2, 80)
  if (index.length > 90_000) index = pageIndex(data, 1, 70)
  index = index.slice(0, 110_000)

  let opening = ""
  for (let i = 0; i < Math.min(30, data.pageCount) && opening.length < 24_000; i++) {
    opening += `\n--- p${i + 1} ---\n${data.pages[i]}`
  }

  const userPrompt = [
    ...moduleLines(mod),
    `The PDF has ${data.pageCount} pages.`,
    data.outline.length ? `\nBookmarks:\n${data.outline.join("\n").slice(0, 20_000)}` : "\nThe PDF has no bookmarks.",
    `\nFirst pages in full:${opening.slice(0, 24_000)}`,
    `\nPage index (PDF page: first lines):\n${index}`,
  ].join("\n")

  const parsed = await chatJson<{ lastPage?: unknown; chapters?: unknown }>({
    system: OUTLINE_PROMPT,
    user: userPrompt,
    temperature: 0.2,
    maxTokens: 10000,
  })
  return tidyOutline(parsed, data.pageCount)
}

const cleanTitle = (value: unknown) =>
  String(value ?? "")
    .replace(/\s*\.{3,}\s*\d*\s*$/, "") // dot leaders + page number
    .replace(/^\s*(chapter|unit|part|section)\s+[\divxlc]+[:.\s-]*/i, "")
    .replace(/^\s*\d+(\.\d+)*[.):]?\s+/, "") // 2.4 / 3. / 1)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150)

/** Clamp pages to the book, keep book order, and work out where each part ends */
export function tidyOutline(parsed: { lastPage?: unknown; chapters?: unknown }, pageCount: number): ProposedChapter[] {
  const page = (v: unknown) => {
    const n = Math.round(Number(v))
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), pageCount) : NaN
  }
  const lastPage = Number.isFinite(page(parsed.lastPage)) ? page(parsed.lastPage) : pageCount

  const chapters = (Array.isArray(parsed.chapters) ? parsed.chapters : [])
    .map((c: Record<string, unknown>) => ({
      title: cleanTitle(c?.title),
      startPage: page(c?.startPage),
      topics: (Array.isArray(c?.topics) ? c.topics : [])
        .map((t: Record<string, unknown>) => ({ title: cleanTitle(t?.title), startPage: page(t?.startPage) }))
        .filter(t => t.title && Number.isFinite(t.startPage)),
    }))
    .filter(c => c.title && (Number.isFinite(c.startPage) || c.topics.length > 0))
    .map(c => ({ ...c, startPage: Number.isFinite(c.startPage) ? c.startPage : c.topics[0].startPage }))
    .filter(c => c.startPage <= lastPage)
    .sort((a, b) => a.startPage - b.startPage)

  return chapters.map((chapter, ci) => {
    const nextStart = chapters[ci + 1]?.startPage ?? lastPage + 1
    const endPage = Math.max(chapter.startPage, Math.min(lastPage, nextStart - 1))
    let topics = chapter.topics
      .filter(t => t.startPage >= chapter.startPage && t.startPage <= endPage)
      .sort((a, b) => a.startPage - b.startPage)
    // No usable sections: the whole chapter is one topic
    if (topics.length === 0) topics = [{ title: chapter.title, startPage: chapter.startPage }]
    // The first topic picks up any introduction pages before it
    topics[0] = { ...topics[0], startPage: chapter.startPage }
    return {
      title: chapter.title,
      startPage: chapter.startPage,
      endPage,
      topics: topics.map((t, ti) => ({
        title: t.title,
        startPage: t.startPage,
        endPage: Math.max(t.startPage, (topics[ti + 1]?.startPage ?? endPage + 1) - 1),
      })),
    }
  })
}

/** The text of pages start..end, marked by page, for a lesson/quiz prompt */
export function pagesText(data: Pick<TextbookData, "pages" | "pageCount">, startPage: number, endPage: number, limit = 40_000) {
  const start = Math.max(1, Math.floor(startPage))
  const end = Math.min(data.pageCount, Math.max(start, Math.floor(endPage)))
  let text = ""
  for (let p = start; p <= end; p++) {
    text += `\n[Page ${p}]\n${data.pages[p - 1] ?? ""}`
    if (text.length >= limit) break
  }
  return text.slice(0, limit).trim()
}

// Warm server instances keep recently used books, so each topic doesn't download it again
const cache = new Map<string, Promise<TextbookData>>()

/** Load the page text saved after reading the book */
export function loadTextbookPages(url: string): Promise<TextbookData> {
  let entry = cache.get(url)
  if (!entry) {
    entry = fetch(url).then(async res => {
      if (!res.ok) throw new Error("The textbook's pages are no longer available. Upload it again.")
      return (await res.json()) as TextbookData
    })
    entry.catch(() => cache.delete(url))
    cache.set(url, entry)
    while (cache.size > 3) cache.delete(cache.keys().next().value!)
  }
  return entry
}
