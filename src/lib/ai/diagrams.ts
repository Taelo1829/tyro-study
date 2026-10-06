import { getOpenAIClient } from "@/lib/ai/openai"

/**
 * Labelled diagrams for lessons (the eye, the heart, a flower, a cell…).
 *
 * The lesson writer doesn't draw diagrams (AI-drawn labels come out wrong).
 * Instead it marks the spot where one belongs:
 *
 *   <div class="diagram" data-search="human eye labelled diagram">The structure of the human eye</div>
 *
 * After the lesson is written, each marker is resolved here:
 * 1. Wikimedia Commons is searched for freely licensed diagrams.
 * 2. The AI looks at the candidates and picks the clearest one with English
 *    labels at the right level (or none, if nothing fits).
 * 3. The marker is replaced with the image, its caption and the credit line
 *    the licence asks for. Markers with no good match are removed.
 *
 * Every step fails safe: a lesson is never lost because a diagram wasn't found.
 */

const COMMONS_API = "https://commons.wikimedia.org/w/api.php"
// Wikimedia asks API users to identify themselves
const USER_AGENT = "TyroStudy/1.0 (https://www.tyrostudy.co.za)"
const MAX_DIAGRAMS = 4
const CANDIDATES_SHOWN_TO_AI = 6
const IMAGE_WIDTH = 900
const MIN_WIDTH = 300

export interface DiagramCandidate {
  title: string
  imageUrl: string
  pageUrl: string
  description: string
  artist: string
  license: string
  width: number
}

interface CommonsPage {
  title: string
  index?: number
  imageinfo?: Array<{
    thumburl?: string
    url?: string
    descriptionurl?: string
    mime?: string
    width?: number
    thumbwidth?: number
    extmetadata?: Record<string, { value?: unknown } | undefined>
  }>
}

const stripTags = (value: unknown) =>
  String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** Freely licensed diagrams on Wikimedia Commons for a search, best match first */
export async function searchCommonsDiagrams(query: string, limit = 12): Promise<DiagramCandidate[]> {
  const url = new URL(COMMONS_API)
  const params: Record<string, string> = {
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    // Drawings and bitmaps only: no photos-of-PDFs, audio or video
    gsrsearch: `${query} filetype:bitmap|drawing`,
    gsrnamespace: "6",
    gsrlimit: String(limit),
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: String(IMAGE_WIDTH),
    iiextmetadatafilter: "ImageDescription|ObjectName|Artist|Credit|LicenseShortName",
  }
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Api-User-Agent": USER_AGENT } })
  if (!res.ok) throw new Error(`Wikimedia search failed (${res.status})`)
  const body = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> } }
  const pages = Object.values(body.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0))

  const out: DiagramCandidate[] = []
  for (const page of pages) {
    const info = page.imageinfo?.[0]
    if (!info) continue
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(info.mime ?? "")) continue
    if ((info.width ?? 0) < MIN_WIDTH) continue
    const imageUrl = info.thumburl || info.url
    if (!imageUrl || !info.descriptionurl) continue
    const meta = info.extmetadata ?? {}
    out.push({
      title: page.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, "").replace(/_/g, " "),
      imageUrl,
      pageUrl: info.descriptionurl,
      description: stripTags(meta.ImageDescription?.value ?? meta.ObjectName?.value).slice(0, 300),
      artist: stripTags(meta.Artist?.value ?? meta.Credit?.value).slice(0, 120) || "Unknown author",
      license: stripTags(meta.LicenseShortName?.value) || "see source",
      width: info.width ?? 0,
    })
  }
  return out
}

const PICK_PROMPT = `You choose a diagram for a page of study notes. You are shown numbered candidate images from Wikimedia Commons.

Pick the ONE candidate that best fits, judged in this order:
1. It clearly shows exactly the structure asked for (not a different organ, a close-up of one part, or an unrelated chart).
2. Its labels are in English (or it has clear numbered/lettered labels). Reject labels in other languages.
3. It is a clean diagram or illustration a student can learn from, at the right level of detail for the course (not cluttered with dozens of labels for a school student, not a medical photo of real tissue or surgery).
4. It is readable at the size of a phone screen.

If none of the candidates is a good fit, answer -1. A wrong or foreign-language diagram is worse than none.

Respond with JSON only: { "choice": <candidate number or -1>, "reason": "<one short sentence>" }`

/** Ask the AI (looking at the images) which candidate fits best; null for none */
export async function pickDiagram(
  want: { caption: string; search: string; context: string },
  candidates: DiagramCandidate[]
): Promise<DiagramCandidate | null> {
  const shown = candidates.slice(0, CANDIDATES_SHOWN_TO_AI)
  if (shown.length === 0) return null

  const listing = shown
    .map((c, i) => `${i + 1}. "${c.title}"${c.description ? ` - ${c.description}` : ""}`)
    .join("\n")
  const text = `Course/topic context: ${want.context}\nDiagram wanted: ${want.caption}\n(searched for: ${want.search})\n\nCandidates:\n${listing}`

  const openai = getOpenAIClient()
  const ask = async (withImages: boolean) => {
    const content: Array<
      { type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "low" } }
    > = [{ type: "text", text: withImages ? text : `${text}\n\n(The images couldn't be loaded: judge from the titles and descriptions.)` }]
    if (withImages) {
      shown.forEach((c, i) => {
        content.push({ type: "text", text: `Candidate ${i + 1}:` })
        content.push({ type: "image_url", image_url: { url: c.imageUrl, detail: "low" } })
      })
    }
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0,
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PICK_PROMPT },
        { role: "user", content },
      ],
    })
    const raw = response.choices[0]?.message?.content ?? "{}"
    const parsed = JSON.parse(raw) as { choice?: unknown }
    const n = Number(parsed.choice)
    return Number.isInteger(n) && n >= 1 && n <= shown.length ? shown[n - 1] : null
  }

  try {
    return await ask(true)
  } catch (error) {
    // OpenAI couldn't download an image (or similar): decide from the text
    console.warn("Diagram pick with images failed, retrying without:", error instanceof Error ? error.message : error)
    try {
      return await ask(false)
    } catch {
      return null
    }
  }
}

/** The HTML that replaces a diagram marker */
export function diagramFigureHtml(caption: string, pick: DiagramCandidate) {
  const alt = escapeHtml(caption || pick.title)
  return (
    `<figure><img src="${escapeHtml(pick.imageUrl)}" alt="${alt}">` +
    `<figcaption>${escapeHtml(caption || pick.title)}<br>` +
    `<em>Diagram: ${escapeHtml(pick.artist)}, ${escapeHtml(pick.license)}, via <a href="${escapeHtml(pick.pageUrl)}">Wikimedia Commons</a></em>` +
    `</figcaption></figure>`
  )
}

// <div class="diagram" data-search="…">caption</div>, attributes in any order, either quote style
const MARKER = /<div\b(?=[^>]*\bclass\s*=\s*["']diagram["'])([^>]*)>([\s\S]*?)<\/div>/gi
const searchAttr = (attrs: string) => /\bdata-search\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs)

/** True when a lesson has diagram markers waiting to be resolved */
export const hasDiagramMarkers = (html: string) => new RegExp(MARKER.source, "i").test(html)

/** Find a diagram for one marker: search, retry with a simpler search, let the AI pick */
async function findDiagram(search: string, caption: string, context: string): Promise<DiagramCandidate | null> {
  const queries = [search, caption, `${caption} diagram`].map(q => q.trim()).filter(Boolean)
  const seen = new Set<string>()
  const candidates: DiagramCandidate[] = []
  for (const q of [...new Set(queries)]) {
    try {
      for (const c of await searchCommonsDiagrams(q)) {
        if (!seen.has(c.pageUrl)) {
          seen.add(c.pageUrl)
          candidates.push(c)
        }
      }
    } catch (error) {
      console.warn("Wikimedia search failed:", error instanceof Error ? error.message : error)
    }
    if (candidates.length >= CANDIDATES_SHOWN_TO_AI) break
  }
  return pickDiagram({ caption, search, context }, candidates)
}

/**
 * Replace every diagram marker in a lesson with a real diagram (or remove it
 * when nothing suitable is found). `context` tells the picker the course and
 * level, e.g. the start of the lesson prompt.
 */
export async function resolveLessonDiagrams(html: string, context: string): Promise<string> {
  const markers = [...html.matchAll(MARKER)]
  if (markers.length === 0) return html

  const results = await Promise.all(
    markers.map(async (m, i) => {
      if (i >= MAX_DIAGRAMS) return ""
      const attr = searchAttr(m[1])
      const caption = stripTags(m[2]).slice(0, 200)
      const search = stripTags(attr?.[1] ?? attr?.[2] ?? caption).slice(0, 120)
      if (!search && !caption) return ""
      try {
        const pick = await findDiagram(search, caption, context.slice(0, 600))
        return pick ? diagramFigureHtml(caption, pick) : ""
      } catch (error) {
        console.warn("Diagram lookup failed:", error instanceof Error ? error.message : error)
        return ""
      }
    })
  )

  let i = 0
  return html.replace(MARKER, () => results[i++] ?? "")
}
