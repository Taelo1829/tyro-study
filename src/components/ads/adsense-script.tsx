import Script from "next/script"
import { ADSENSE_CLIENT } from "@/lib/site"

/**
 * Loads Google AdSense (Auto ads). Only include this on pages with real
 * content - lessons - never on login/register, loading, error or otherwise
 * empty screens (AdSense rejects "Google-served ads on screens without
 * publisher-content"), nor on pages that are mostly navigation, like lists of
 * modules or topics (rejected as "Site Behavior: Navigation").
 */
export function AdSenseScript() {
  return (
    <Script
      id="adsense"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
    />
  )
}
