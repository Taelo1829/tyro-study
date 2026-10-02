/**
 * Topic lesson content: shared by the admin editor and the student view.
 *
 * Content is stored as HTML written in the in-app editor. Older topics may
 * hold plain text / light markdown (and bare video URLs on their own line);
 * those are converted on the fly so they still look right.
 *
 * Everything is passed through an allowlist sanitizer before it's shown or
 * pasted into the editor, so copied Word/PDF/web content comes in clean and
 * nothing unsafe (scripts, event handlers, odd iframes) can get through.
 */

import { splitMath } from "@/components/ui/math-text"

// ── Video embeds ─────────────────────────────────────────────────────────────

export function getVideoEmbedHtml(rawUrl: string): string | null {
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (!["http:", "https:"].includes(url.protocol)) return null

  const host = url.hostname.replace(/^www\./, "")
  let embedUrl = ""

  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = url.searchParams.get("v") ?? url.pathname.split("/").filter(Boolean).at(-1)
    if (id) embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(id)}?enablejsapi=1`
  } else if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0]
    if (id) embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(id)}?enablejsapi=1`
  } else if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).at(-1)
    if (id) embedUrl = `https://player.vimeo.com/video/${encodeURIComponent(id)}`
  }

  if (embedUrl) {
    return `<div class="topic-video-embed"><iframe src="${embedUrl}" title="Embedded topic video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`
  }
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url.href)) {
    return `<div class="topic-video-embed"><video src="${url.href}" controls></video></div>`
  }
  return null
}

// ── Legacy plain text / markdown ─────────────────────────────────────────────

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** True when the content was written in the editor (contains real tags) */
export function looksLikeHtml(content: string) {
  return /<\/?(p|div|h[1-6]|ul|ol|li|br|strong|em|b|i|u|a|img|blockquote|pre|table|span|figure|hr|iframe|video)\b/i.test(content)
}

function inlineMarkdown(text: string) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
}

/** Convert old plain-text / markdown-ish content to HTML */
export function legacyToHtml(content: string): string {
  const out: string[] = []
  let list: "ul" | "ol" | null = null
  let para: string[] = []

  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inlineMarkdown).join("<br>")}</p>`)
    para = []
  }
  const closeList = () => {
    if (list) out.push(`</${list}>`)
    list = null
  }

  for (const raw of content.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd()
    const video = getVideoEmbedHtml(line)
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/)
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/)

    if (!line.trim()) {
      flushPara()
      closeList()
    } else if (video) {
      flushPara()
      closeList()
      out.push(video)
    } else if (heading) {
      flushPara()
      closeList()
      const level = Math.min(heading[1].length + 1, 4)
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`)
    } else if (bullet || numbered) {
      flushPara()
      const kind = bullet ? "ul" : "ol"
      if (list !== kind) {
        closeList()
        out.push(`<${kind}>`)
        list = kind
      }
      out.push(`<li>${inlineMarkdown((bullet ?? numbered)![1])}</li>`)
    } else if (/^>\s?/.test(line)) {
      flushPara()
      closeList()
      out.push(`<blockquote><p>${inlineMarkdown(line.replace(/^>\s?/, ""))}</p></blockquote>`)
    } else {
      closeList()
      para.push(line)
    }
  }
  flushPara()
  closeList()
  return out.join("")
}

// ── Sanitizer (browser only) ─────────────────────────────────────────────────

const ALLOWED_TAGS = new Set([
  "P", "BR", "STRONG", "EM", "U", "S", "SUB", "SUP", "A", "UL", "OL", "LI",
  "H2", "H3", "H4", "BLOCKQUOTE", "PRE", "CODE", "IMG", "FIGURE", "FIGCAPTION",
  "HR", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "DIV", "SPAN", "IFRAME", "VIDEO",
])
/** Renamed to the semantic equivalent */
const RENAME: Record<string, string> = { B: "strong", I: "em", STRIKE: "s", DEL: "s", H1: "h2", H5: "h4", H6: "h4" }
/** Removed together with everything inside */
const DROP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "OBJECT", "EMBED", "FORM", "INPUT", "BUTTON", "SELECT", "TEXTAREA", "META", "LINK", "TITLE", "HEAD", "SVG", "MATH"])
const ALLOWED_CLASSES = new Set(["topic-video-embed", "callout", "callout-tip", "callout-warning"])

const ALLOWED_ATTRS: Record<string, string[]> = {
  A: ["href"],
  IMG: ["src", "alt"],
  IFRAME: ["src", "title", "allow", "allowfullscreen"],
  VIDEO: ["src", "controls"],
  TD: ["colspan", "rowspan"],
  TH: ["colspan", "rowspan"],
  OL: ["start"],
}

function safeUrl(value: string, { media = false } = {}) {
  const v = value.trim()
  if (/^https?:\/\//i.test(v)) return v
  if (v.startsWith("/") && !v.startsWith("//")) return v
  if (!media && (/^mailto:/i.test(v) || v.startsWith("#"))) return v
  return null
}

function allowedIframe(src: string) {
  try {
    const url = new URL(src)
    return (
      url.protocol === "https:" &&
      ((url.hostname === "www.youtube.com" && url.pathname.startsWith("/embed/")) ||
        url.hostname === "www.youtube-nocookie.com" ||
        url.hostname === "player.vimeo.com")
    )
  } catch {
    return false
  }
}

function cleanElement(el: Element, doc: Document): Node | null {
  let tag = el.tagName.toUpperCase()
  if (DROP.has(tag)) return null
  if (RENAME[tag]) tag = RENAME[tag].toUpperCase()

  // Word/Google Docs bold & italic arrive as styled spans
  if (tag === "SPAN") {
    const style = (el as HTMLElement).style
    const bold = style?.fontWeight === "bold" || Number(style?.fontWeight) >= 600
    const italic = style?.fontStyle === "italic"
    if (bold || italic) {
      let node: Node = doc.createDocumentFragment()
      for (const child of [...el.childNodes]) {
        const c = cleanNode(child, doc)
        if (c) node.appendChild(c)
      }
      if (italic) {
        const em = doc.createElement("em")
        em.appendChild(node)
        node = em
      }
      if (bold) {
        const strong = doc.createElement("strong")
        strong.appendChild(node)
        node = strong
      }
      return node
    }
  }

  const children = () => {
    const frag = doc.createDocumentFragment()
    for (const child of [...el.childNodes]) {
      const c = cleanNode(child, doc)
      if (c) frag.appendChild(c)
    }
    return frag
  }

  // Unknown tags (font, section, article, …) are unwrapped, keeping their text
  if (!ALLOWED_TAGS.has(tag)) return children()

  if (tag === "IFRAME" && !allowedIframe(el.getAttribute("src") ?? "")) return null

  const out = doc.createElement(tag.toLowerCase())
  for (const name of ALLOWED_ATTRS[tag] ?? []) {
    const value = el.getAttribute(name)
    if (value === null) continue
    if (name === "href") {
      const url = safeUrl(value)
      if (url) out.setAttribute("href", url)
    } else if (name === "src") {
      const url = safeUrl(value, { media: true })
      if (url) out.setAttribute("src", url)
    } else {
      out.setAttribute(name, value)
    }
  }
  if (tag === "A") {
    out.setAttribute("target", "_blank")
    out.setAttribute("rel", "noopener noreferrer")
  }
  if (tag === "IMG") {
    if (!out.getAttribute("src")) return null
    out.setAttribute("loading", "lazy")
  }
  if (tag === "DIV") {
    const classes = [...el.classList].filter(c => ALLOWED_CLASSES.has(c))
    if (classes.length === 0) {
      // Plain divs (common from paste/contentEditable): a wrapper around
      // blocks is unwrapped; a div holding just text becomes a paragraph
      const inner = children()
      if ([...inner.childNodes].some(isBlock)) return inner
      const p = doc.createElement("p")
      p.appendChild(inner)
      return p.childNodes.length ? p : null
    }
    out.setAttribute("class", classes.join(" "))
  }
  if (tag === "SPAN") {
    return children()
  }

  out.appendChild(children())
  return out
}

const BLOCK_TAGS = new Set(["P", "H2", "H3", "H4", "UL", "OL", "BLOCKQUOTE", "PRE", "TABLE", "FIGURE", "HR", "DIV"])
const isBlock = (n: Node) => n.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((n as Element).tagName.toUpperCase())

/** Wrap loose text/inline runs at the top level into paragraphs */
function wrapLooseInline(root: Element, doc: Document) {
  let run: Node[] = []
  const flush = (before: Node | null) => {
    if (run.some(n => (n.textContent ?? "").trim() || (n as Element).querySelector?.("img"))) {
      const p = doc.createElement("p")
      root.insertBefore(p, before)
      run.forEach(n => p.appendChild(n))
    } else {
      run.forEach(n => n.parentNode === root && n.textContent === "" && root.removeChild(n))
    }
    run = []
  }
  for (const child of [...root.childNodes]) {
    if (isBlock(child)) flush(child)
    else run.push(child)
  }
  flush(null)
}

function cleanNode(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent ?? "")
  if (node.nodeType === Node.ELEMENT_NODE) return cleanElement(node as Element, doc)
  return null // comments, processing instructions, …
}

/** Turn `[[1,2],[3,4]]` in text into matrix markup (styled by .tc-matrix) */
function renderMatrices(root: Element, doc: Document) {
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if ((n.parentElement?.closest("pre, code"))) continue
    if (n.textContent?.includes("[[")) textNodes.push(n as Text)
  }
  for (const text of textNodes) {
    const parts = splitMath(text.textContent ?? "")
    if (parts.every(p => p.type === "text")) continue
    const frag = doc.createDocumentFragment()
    for (const part of parts) {
      if (part.type === "text") {
        frag.appendChild(doc.createTextNode(part.value))
        continue
      }
      const m = doc.createElement("span")
      m.className = "tc-matrix"
      m.setAttribute("role", "math")
      m.setAttribute("aria-label", `Matrix ${part.rows.map(r => r.join(", ")).join("; ")}`)
      const grid = doc.createElement("span")
      grid.className = "tc-matrix-grid"
      grid.style.gridTemplateColumns = `repeat(${part.rows[0].length}, auto)`
      for (const row of part.rows) {
        for (const cell of row) {
          const c = doc.createElement("span")
          c.textContent = cell
          grid.appendChild(c)
        }
      }
      m.appendChild(grid)
      frag.appendChild(m)
    }
    text.replaceWith(frag)
  }
}

/**
 * Clean HTML so it is safe to display and consistent to look at.
 * Browser only (uses DOMParser); returns "" on the server.
 */
export function sanitizeTopicHtml(html: string, { matrices = false } = {}): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return ""
  const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html")
  const doc = document.implementation.createHTMLDocument("")
  const root = doc.createElement("div")
  for (const child of [...parsed.body.childNodes]) {
    const c = cleanNode(child, doc)
    if (c) root.appendChild(c)
  }
  wrapLooseInline(root, doc)
  // Drop empty paragraphs left behind by editing/pasting (keep intentional <br> spacers)
  root.querySelectorAll("p").forEach(p => {
    if (!p.textContent?.trim() && !p.querySelector("img, iframe, video, br")) p.remove()
  })
  if (matrices) renderMatrices(root, doc)
  return root.innerHTML
}

/** Content as stored → safe HTML for students */
export function renderTopicContent(content: string | null | undefined): string {
  if (!content?.trim()) return ""
  const html = looksLikeHtml(content) ? content : legacyToHtml(content)
  return sanitizeTopicHtml(html, { matrices: true })
}

/** Content as stored → HTML to load into the editor */
export function contentForEditor(content: string | null | undefined): string {
  if (!content?.trim()) return ""
  return looksLikeHtml(content) ? content : legacyToHtml(content)
}

/** Rough reading time in minutes (≈200 words/min), at least 1 */
export function readingMinutes(html: string): number {
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}
