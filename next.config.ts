import type { NextConfig } from "next";
import withPWAInit from "next-pwa"

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["pdf-parse", "xlsx"],
};


const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
})

export default nextConfig;
