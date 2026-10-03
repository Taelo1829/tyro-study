import type { MetadataRoute } from "next"
import { listPublicTopics } from "@/lib/public-notes"
import { siteUrl } from "@/lib/site"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const topics = await listPublicTopics().catch(() => [])
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/notes`, changeFrequency: "weekly", priority: 0.9 },
    ...[...new Set(topics.map(t => t.moduleId))].map(id => ({ url: `${base}/notes/m/${id}`, changeFrequency: "weekly" as const, priority: 0.85 })),
    ...topics.map(t => ({ url: `${base}/notes/${t.id}`, changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: `${base}/about`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ]
}
