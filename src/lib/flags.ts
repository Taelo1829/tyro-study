/**
 * Feature flags: switch a feature off, or roll it out gradually, without a
 * code change.
 *
 * Each flag reads one environment variable, FLAG_<NAME> (set in Vercel per
 * environment; a change applies after a redeploy, about 2 minutes):
 *
 *   on | off            everyone / no one
 *   admins              admins (role ADMIN, superusers included) only: try it in production first
 *   25%                 a stable 25% of signed-in users (same users every time),
 *                       plus admins
 *   (unset)             the flag's default below
 *
 * Server-only (reads process.env). Pass the result to client components as a
 * prop. Use flags for risky or regulated features, and delete a flag once the
 * feature is permanently on: every flag is a branch in the code to maintain.
 */
import { createHash } from "node:crypto"

export const FLAGS = {
  /**
   * New sign-ups (and profile switches) to the high school level. Turn off to
   * pause under-18 sign-ups until parental consent exists (POPIA s35,
   * business/08 §6.2). Existing high school learners are not affected.
   */
  highschool_signup: { default: "on" },
  /** First-party analytics events (business tracking plan). Kill switch. */
  analytics: { default: "on" },
} as const satisfies Record<string, { default: FlagValue }>

export type FlagName = keyof typeof FLAGS
export type FlagValue = "on" | "off" | "admins" | `${number}%`

export interface FlagContext {
  userId?: string | null
  role?: string | null
}

// Users have role ADMIN or STUDENT (prisma/schema.prisma); superusers are admins.
const isAdminRole = (role?: string | null) => (role ?? "").toUpperCase() === "ADMIN"

function envName(flag: FlagName) {
  return `FLAG_${flag.toUpperCase()}`
}

/** Parses a raw setting; anything unrecognised falls back to the default (and is reported by flagSettings). */
export function parseFlag(raw: string | undefined | null): FlagValue | null {
  const v = (raw ?? "").trim().toLowerCase()
  if (v === "on" || v === "true" || v === "1") return "on"
  if (v === "off" || v === "false" || v === "0") return "off"
  if (v === "admins") return "admins"
  const m = v.match(/^(\d{1,3})%$/)
  if (m && Number(m[1]) <= 100) return `${Number(m[1])}%`
  return null
}

export function flagValue(flag: FlagName): FlagValue {
  return parseFlag(process.env[envName(flag)]) ?? FLAGS[flag].default
}

/** 0–99, stable for a user and flag, independent between flags. */
export function bucket(flag: string, userId: string): number {
  return createHash("sha256").update(`${flag}:${userId}`).digest().readUInt32BE(0) % 100
}

export function isEnabled(flag: FlagName, ctx: FlagContext = {}): boolean {
  const value = flagValue(flag)
  if (value === "on") return true
  if (value === "off") return false
  const isAdmin = isAdminRole(ctx.role)
  if (value === "admins") return isAdmin
  const percent = Number(value.slice(0, -1))
  if (isAdmin) return true
  if (!ctx.userId) return false // percentage rollouts apply to signed-in users only
  return bucket(flag, ctx.userId) < percent
}

/** Current settings, for the release checklist and /api/health-style debugging. Names and values only. */
export function flagSettings(): { flag: FlagName; value: FlagValue; source: "env" | "default" | "invalid env (default used)" }[] {
  return (Object.keys(FLAGS) as FlagName[]).map(flag => {
    const raw = process.env[envName(flag)]
    const parsed = parseFlag(raw)
    return {
      flag,
      value: parsed ?? FLAGS[flag].default,
      source: raw === undefined || raw === "" ? "default" : parsed ? "env" : "invalid env (default used)",
    }
  })
}
