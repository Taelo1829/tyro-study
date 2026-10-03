/** Public site details used by the landing, policy and notes pages, sitemap and ads */

export const SITE_NAME = "Tyro Study"
export const CONTACT_EMAIL = "tseholoba2@gmail.com"

/** Google AdSense publisher ID (also in public/ads.txt) */
export const ADSENSE_CLIENT = "ca-pub-4704249489359180"

/** The site's public address, for the sitemap and canonical links */
export function siteUrl(): string {
  const url = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://tyro-study.vercel.app"
  return url.replace(/\/+$/, "")
}
