import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // Unit and integration tests never touch a real database. Prisma still
    // needs a URL to build its client, so give it one that is never used.
    env: { DATABASE_URL: "postgresql://test:test@127.0.0.1:1/never_used" },
    testTimeout: 20_000,
  },
})
