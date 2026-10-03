import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/site"

/** Public pages are crawlable; the signed-in app and APIs aren't */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/notes", "/about", "/privacy", "/terms"],
        disallow: ["/api/", "/dashboard", "/modules", "/timetable", "/chat", "/settings", "/profile", "/admin", "/flashcards", "/assignments"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
