/**
 * Push subscription endpoints come from the browser, and the server later
 * POSTs to them (src/lib/web-push.ts). Without a check, anyone signed in
 * could register any URL and make the server send requests to it (SSRF),
 * for example to internal addresses. Only accept the browser push services.
 */
const PUSH_HOSTS = [
  "fcm.googleapis.com", // Chrome, Edge (Chromium), Samsung Internet, Opera, Brave
  "android.googleapis.com", // older Chrome
  "updates.push.services.mozilla.com", // Firefox
  "push.services.mozilla.com",
  "notify.windows.com", // legacy Edge / Windows (subdomains)
  "push.apple.com", // Safari on macOS and iOS 16.4+ (web.push.apple.com)
]

export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 2048) return false
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return false
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false
  const host = url.hostname.toLowerCase()
  return PUSH_HOSTS.some(h => host === h || host.endsWith(`.${h}`))
}
