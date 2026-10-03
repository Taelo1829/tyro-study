import withPWAInit from "next-pwa"

const nextConfig = {
  reactStrictMode: true,
  // pdf-parse needs the native @napi-rs/canvas package at runtime; keep both
  // external and make sure Vercel ships the Linux binary with the API routes.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas", "xlsx"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*"],
  },
}


const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
})

export default withPWA(nextConfig);
