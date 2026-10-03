/**
 * Turn whatever was typed or pasted into plain text: drops HTML tags (e.g.
 * "<p>&nbsp;</p>" from a rich editor), decodes common entities, keeps line
 * breaks and tidies spaces. Used for fields shown as plain text, like
 * module descriptions.
 */
export function toPlainText(value: string | null | undefined): string {
  if (!value) return ""
  return value
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;| /gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
