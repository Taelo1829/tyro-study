#!/usr/bin/env node
/**
 * Checks that the environment variables an environment needs are set, before
 * the build starts. Prints variable NAMES only, never values.
 *
 *   node scripts/ci/check-env.mjs                # uses VERCEL_ENV, else "development"
 *   APP_ENV=production node scripts/ci/check-env.mjs
 *
 * Exits 1 when a REQUIRED variable is missing or unsafe; RECOMMENDED ones only
 * warn, so a missing optional service never blocks a release.
 */
import { config } from "dotenv"

config({ path: [".env.local", ".env"], quiet: true })

const env = process.env.APP_ENV || process.env.VERCEL_ENV || "development"
const has = k => typeof process.env[k] === "string" && process.env[k].trim() !== ""

// Required everywhere the app runs.
const REQUIRED = ["DATABASE_URL", "NEXTAUTH_SECRET"]
// Features that degrade without these; warn instead of failing.
const RECOMMENDED = [
  "NEXTAUTH_URL", "APP_URL", // both have fallbacks; set them to the environment's own address
  "DIRECT_DATABASE_URL|DATABASE_URL_UNPOOLED",
  "RESEND_API_KEY", "EMAIL_FROM",
  "BLOB_READ_WRITE_TOKEN",
  "PUSHER_APP_ID", "PUSHER_SECRET", "NEXT_PUBLIC_PUSHER_KEY", "NEXT_PUBLIC_PUSHER_CLUSTER",
  "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT",
  "OPENAI_API_KEY", "CRON_SECRET",
  "MONITOR_TOKEN", // /api/health details for the monitor workflow (business/11)
]
const PLACEHOLDERS = [/^change-?me/i, /not-a-secret/i, /^ci-only/i, /^dummy$/i, /local-pentest/i, /^x+$/i]

const errors = [], warnings = []
const need = REQUIRED
for (const k of need) if (!has(k)) errors.push(`${k} is missing`)

if (env !== "development") {
  for (const k of RECOMMENDED) if (!k.split("|").some(has)) warnings.push(`${k.replace("|", " or ")} is not set; that feature won't work here`)
  const secret = process.env.NEXTAUTH_SECRET ?? ""
  if (secret && PLACEHOLDERS.some(re => re.test(secret))) errors.push("NEXTAUTH_SECRET is a placeholder (use: openssl rand -base64 32)")
  else if (secret && secret.length < 32) warnings.push("NEXTAUTH_SECRET is shorter than 32 characters; rotate it (openssl rand -base64 32), which signs everyone out once")
}

if (env === "production") {
  // Production must never run with test or local settings.
  if (/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) errors.push("DATABASE_URL points at localhost in production")
  for (const k of ["NEXTAUTH_URL", "APP_URL"]) {
    if (has(k) && !process.env[k].startsWith("https://")) errors.push(`${k} must start with https:// in production`)
  }
  if (process.env.MIGRATE_ON_BUILD === "1") errors.push("MIGRATE_ON_BUILD=1 is set in production; production is migrated by the release workflow only")
}

const label = `[check-env] ${env}`
for (const w of warnings) console.warn(`${label}: warning: ${w}`)
if (errors.length) {
  for (const e of errors) console.error(`${label}: error: ${e}`)
  console.error(`${label}: fix these in Vercel → Project → Settings → Environment Variables (${env}).`)
  process.exit(1)
}
console.log(`${label}: ok (${need.length} required set, ${warnings.length} warning(s))`)
