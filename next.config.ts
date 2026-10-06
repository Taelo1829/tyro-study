import withPWAInit from "next-pwa"

const nextConfig = {
  reactStrictMode: true,
  // pdf-parse needs the native @napi-rs/canvas package at runtime; keep both
  // external and make sure Vercel ships the Linux binary with the API routes.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas", "xlsx"],
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
