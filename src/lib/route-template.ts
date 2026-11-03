/**
 * Page paths → templates, so /modules/abc123/topics/xyz789 groups as
 * /modules/[id]/topics/[id] in error tracking and performance reports.
 * Safe to import on the client.
 */
export function routeTemplate(path: string | null | undefined): string | null {
  if (!path) return null
  const clean = path.split("?")[0].split("#")[0]
  return clean
    .split("/")
    .map(seg => (/^[0-9a-f-]{16,}$|^c[a-z0-9]{20,}$|^\d+$|^[A-Za-z0-9_-]{20,}$/i.test(seg) ? "[id]" : seg))
    .join("/")
    .slice(0, 200)
}
