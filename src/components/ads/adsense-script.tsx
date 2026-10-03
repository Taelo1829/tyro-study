import Script from "next/script"
import { ADSENSE_CLIENT } from "@/lib/site"

/**
 * Loads Google AdSense (Auto ads). Only include this on pages with real
 * content — lessons, notes, the home page — never on login/register,
 * loading, error or otherwise empty screens. (AdSense rejects sites that show
 * "Google-served ads on screens without publisher-content".)
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
