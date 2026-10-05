import { chatJson } from "@/lib/ai/openai"
import { UNISA_CONTEXT, moduleCode } from "@/lib/ai/unisa"

/**
 * Course import: read a UNISA qualification page to find a course's modules,
 * and outline a new module (chapters and topics) from its UNISA module page.
 *
 * Pages are only fetched from UNISA's own site, so an admin can't make the
 * server request arbitrary addresses.
 */

const UNISA_HOSTS = new Set(["www.unisa.ac.za", "unisa.ac.za", "w2.unisa.ac.za"])
const PAGE_LIMIT = 60_000

export function isUnisaUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  try {
    const url = new URL(value)
    return url.protocol === "https:" && UNISA_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "-", mdash: "-", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"' }

function decode(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
}

/**
 * A UNISA page as plain text. Links to module pages are kept as
 * "Name [page: URL]" so the AI can hand them back for each module.
 */
export async function readUnisaPage(url: string): Promise<string> {
  if (!isUnisaUrl(url)) throw new Error("Use a link to a page on www.unisa.ac.za")
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TyroStudy/1.0)", Accept: "text/html" },
    signal: AbortSignal.timeout(20_000),
    redirect: "follow",
  }).catch(() => null)
  if (!res) throw new Error("Couldn't reach the UNISA website. Try again in a moment.")
  if (!isUnisaUrl(res.url || url)) throw new Error("That link led away from the UNISA website")
  if (!res.ok) throw new Error(`The UNISA page couldn't be opened (${res.status}). Check the link.`)
  const html = (await res.text()).slice(0, 3_000_000)

  const base = res.url || url
  const text = decode(
    html
      .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, inner: string) => {
        const label = inner.replace(/<[^>]*>/g, " ").trim()
        if (!/All-modules|module/i.test(href)) return ` ${label} `
        try {
          return ` ${label} [page: ${new URL(decode(href), base).toString()}] `
        } catch {
          return ` ${label} `
        }
      })
      .replace(/<\/(p|div|li|tr|h\d|table|section)>|<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
  )
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
  return text.slice(0, PAGE_LIMIT)
}

// ---------------------------------------------------------------- finding modules

export interface FoundModule {
  code: string
  title: string
  /** Year level 1–4 */
  year: number
  group: "compulsory" | "elective"
  /** UNISA module page, when known */
  url: string | null
}

const DISCOVER_PAGE_PROMPT = `You read UNISA qualification pages and list the modules in the qualification's curriculum.

Rules:
- List ONLY modules that appear on the page. Never add modules from memory.
- code: the module code exactly as shown (e.g. COS1511). title: the module name without the code (e.g. Introduction to Programming I).
- year: the year/level the page puts it in (1, 2, 3 or 4). If unclear, use the first digit of the code.
- group: "compulsory" for compulsory/core modules, "elective" for modules students choose from (elective groups, "choose any", "one of").
- url: the module's page link given after it as [page: ...], or null.
- Each module once.

Respond with JSON only: { "qualification": "name and code of the qualification", "modules": [ { "code": "…", "title": "…", "year": 1, "group": "compulsory", "url": "…" } ] }`

const DISCOVER_MEMORY_PROMPT = `You know the curricula of UNISA (University of South Africa) qualifications.

${UNISA_CONTEXT}

List the modules of the qualification the admin names, as UNISA currently offers it.
- Only list modules you are confident are real UNISA modules in this qualification, with their real codes. Leave out anything you are unsure about rather than guessing; the admin will add missing ones.
- code: e.g. COS1511. title: the module name without the code.
- year: 1, 2, 3 or 4. group: "compulsory" or "elective". url: null.

Respond with JSON only: { "qualification": "…", "modules": [ { "code": "…", "title": "…", "year": 1, "group": "compulsory", "url": null } ] }`

export async function discoverModules(input: {
  courseTitle: string
  courseDescription: string | null
  url?: string | null
}): Promise<{ qualification: string; source: "page" | "ai"; modules: FoundModule[] }> {
  const fromPage = !!input.url
  const user = fromPage
    ? `Qualification page (${input.url}):\n\n${await readUnisaPage(input.url!)}`
    : [`Qualification: ${input.courseTitle}`, input.courseDescription ? `About it: ${input.courseDescription}` : ""].filter(Boolean).join("\n")

  const parsed = await chatJson<{ qualification?: unknown; modules?: unknown }>({
    system: fromPage ? DISCOVER_PAGE_PROMPT : DISCOVER_MEMORY_PROMPT,
    user,
    temperature: 0.1,
    maxTokens: 8000,
  })

  const seen = new Set<string>()
  const modules: FoundModule[] = []
  for (const m of (Array.isArray(parsed.modules) ? parsed.modules : []) as Record<string, unknown>[]) {
    const code = String(m?.code ?? "").replace(/\s+/g, "").toUpperCase()
    if (!/^[A-Z]{3,4}\d{4}$/.test(code) || seen.has(code)) continue
    seen.add(code)
    const title = String(m?.title ?? "")
      .replace(new RegExp(`\\b${code}\\b`, "i"), "")
      .replace(/^[\s\-–:]+|[\s\-–:]+$/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 150)
    const year = Number(m?.year)
    modules.push({
      code,
      title: title || code,
      year: year >= 1 && year <= 4 ? Math.floor(year) : Number(code.match(/\d/)![0]) || 1,
      group: m?.group === "elective" ? "elective" : "compulsory",
      url: isUnisaUrl(m?.url) ? (m.url as string) : null,
    })
  }
  modules.sort((a, b) => a.year - b.year || (a.group === b.group ? 0 : a.group === "compulsory" ? -1 : 1) || a.code.localeCompare(b.code))

  return {
    qualification: typeof parsed.qualification === "string" && parsed.qualification.trim() ? parsed.qualification.trim().slice(0, 200) : input.courseTitle,
    source: fromPage ? "page" : "ai",
    modules,
  }
}

/** The code at the start of a Tyro module title ("COS1511 - …"), for matching */
export function codeOfModuleTitle(title: string): string | null {
  return moduleCode(title)?.code ?? null
}

// ---------------------------------------------------------------- outlining a module

export interface OutlineTopic {
  title: string
  /** Mostly concepts and facts to remember (gets flashcards), rather than calculation or coding practice */
  theory: boolean
}

export interface ModuleOutline {
  description: string
  chapters: { title: string; topics: OutlineTopic[] }[]
}

const OUTLINE_PROMPT = `You are a UNISA lecturer planning a module's study material: its chapters and the topics in each, in teaching order.

${UNISA_CONTEXT}

Plan:
- Follow the order and scope of what UNISA's study guide and prescribed book for this module would cover at this year level. If the UNISA module page is given, its purpose statement and outcomes take priority.
- 5 to 10 chapters, each with 2 to 6 topics. Chapter titles name the area (no "Chapter 1:" prefix). Topic titles are specific (e.g. "Gaussian elimination", not "Introduction"). No "Revision", "Summary" or "Exam preparation" topics.
- theory: true when the topic is mostly definitions, concepts, facts, rules or principles a student must remember (good for flashcards); false when it is mostly calculation, problem solving or programming practice.
- description: one or two plain sentences on what the module covers, for students deciding whether to join (no "This module will..." boilerplate from the page; say it in your own words).

Respond with JSON only: { "description": "…", "chapters": [ { "title": "…", "topics": [ { "title": "…", "theory": true } ] } ] }`

const MAX_CHAPTERS = 12
const MAX_TOPICS_PER_CHAPTER = 8

export async function outlineModule(input: {
  code: string
  title: string
  year: number
  courseTitle: string
  pageText: string | null
}): Promise<ModuleOutline> {
  const user = [
    `UNISA module: ${input.code} ${input.title}`,
    `Year level: ${input.year} (NQF ${input.year + 4})`,
    `Part of: ${input.courseTitle}`,
    input.pageText ? `\nUNISA module page:\n${input.pageText.slice(0, 12_000)}` : "\nThe module page couldn't be read. Use what this UNISA module normally covers.",
  ].join("\n")

  const parsed = await chatJson<{ description?: unknown; chapters?: unknown }>({ system: OUTLINE_PROMPT, user, temperature: 0.3, maxTokens: 4000 })
  const clean = (v: unknown) => String(v ?? "").replace(/—/g, ", ").replace(/\s+/g, " ").trim().slice(0, 150)

  const chapters = (Array.isArray(parsed.chapters) ? parsed.chapters : [])
    .map((c: Record<string, unknown>) => ({
      title: clean(c?.title).replace(/^chapter\s*\d+\s*[:.\-]\s*/i, ""),
      topics: (Array.isArray(c?.topics) ? c.topics : [])
        .map((t: Record<string, unknown>) => ({ title: clean(t?.title), theory: t?.theory === true }))
        .filter(t => t.title)
        .slice(0, MAX_TOPICS_PER_CHAPTER),
    }))
    .filter(c => c.title && c.topics.length > 0)
    .slice(0, MAX_CHAPTERS)
  if (chapters.length === 0) throw new Error(`The AI couldn't plan ${input.code}. Try again.`)

  const description = typeof parsed.description === "string" ? parsed.description.replace(/—/g, ", ").trim().slice(0, 1000) : ""
  return { description, chapters }
}
