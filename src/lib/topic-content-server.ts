import sanitizeHtml from "sanitize-html"
import { legacyToHtml, looksLikeHtml } from "@/lib/topic-content"

/**
 * Server-side version of renderTopicContent (lib/topic-content.ts): turns a
 * stored lesson into clean HTML on the server, so public pages contain the
 * lesson text in the page itself - that's what Google (and AdSense review)
 * reads. Same allow-list as the browser cleaner.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "em", "u", "s", "sub", "sup", "a", "ul", "ol", "li",
    "h2", "h3", "h4", "blockquote", "pre", "code", "img", "figure", "figcaption",
    "hr", "table", "thead", "tbody", "tr", "th", "td", "div", "span", "iframe", "video",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "loading"],
    iframe: ["src", "title", "allow", "allowfullscreen"],
    video: ["src", "controls"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
    ol: ["start"],
    div: ["class"],
  },
  allowedClasses: { div: ["topic-video-embed", "callout", "callout-tip", "callout-warning"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"], video: ["http", "https"] },
  allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"],
  transformTags: {
    b: "strong",
    i: "em",
    h1: "h2",
    h5: "h4",
    h6: "h4",
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
    img: sanitizeHtml.simpleTransform("img", { loading: "lazy" }),
  },
  nonTextTags: ["style", "script", "textarea", "option", "noscript", "title"],
}

export function renderTopicContentServer(content: string | null | undefined): string {
  if (!content?.trim()) return ""
  const html = looksLikeHtml(content) ? content : legacyToHtml(content)
  return sanitizeHtml(html, OPTIONS)
    .replace(/<p>(\s|&nbsp;|<br \/>|<br>)*<\/p>/g, "")
    .trim()
}

/** Plain-text summary of a lesson (for meta descriptions) */
export function lessonSummary(content: string | null | undefined, length = 160): string {
  const text = sanitizeHtml(renderTopicContentServer(content), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
  return text.length > length ? `${text.slice(0, length - 1).replace(/\s+\S*$/, "")}…` : text
}
