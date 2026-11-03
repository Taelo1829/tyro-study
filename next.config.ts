import withPWAInit from "next-pwa"

// Security headers for every response (backlog TS-004). The CSP here only sets
// directives that can't break scripts, styles, ads or embeds; a full
// script/style CSP should be trialled as Content-Security-Policy-Report-Only first.
//
// Rolled out in stages (business/10 §4): browsers remember HSTS for max-age
// seconds and Vercel Instant Rollback can't undo that, so it starts at one day
// and is raised with HSTS_MAX_AGE (Vercel env, then redeploy) once the site and
// every tyrostudy.co.za subdomain are confirmed HTTPS-only:
//   v1.0.0: 86400 (1 day)  →  after 1 week: 31536000  →  later: 63072000 + HSTS_PRELOAD=1
// SECURITY_HEADERS=off removes them all (emergency switch; redeploy to apply).
const hstsMaxAge = Number(process.env.HSTS_MAX_AGE) > 0 ? Number(process.env.HSTS_MAX_AGE) : 86400
const hsts = `max-age=${hstsMaxAge}; includeSubDomains${process.env.HSTS_PRELOAD === "1" ? "; preload" : ""}`
const securityHeaders = [
  { key: "Strict-Transport-Security", value: hsts },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'" },
]
const headersEnabled = process.env.SECURITY_HEADERS !== "off"

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return headersEnabled ? [{ source: "/:path*", headers: securityHeaders }] : []
  },
  // pdf-parse needs the native @napi-rs/canvas package at runtime; keep both
  // external and make sure Vercel ships the Linux binary with the API routes.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas", "exceljs"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*"],
  },
  // Send the old Vercel address (and the bare domain) to the real site,
  // keeping the path and query, e.g. /notes/abc -> www.tyrostudy.co.za/notes/abc
  async redirects() {
    return ["tyro-study.vercel.app", "tyrostudy.co.za"].map(host => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: "https://www.tyrostudy.co.za/:path*",
      permanent: true,
    }))
  },
}


const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
})

export default withPWA(nextConfig);
