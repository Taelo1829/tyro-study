import type { NextConfig } from "next";
import withPWAInit from "next-pwa"

const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pdf-parse", "xlsx"],
}


const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
})

export default withPWA(nextConfig);
