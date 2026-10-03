import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { codeEmailHtml, sendEmail } from "@/lib/email"
import { AUTH_SECRET } from "@/lib/auth-cookies"
import { SITE_NAME } from "@/lib/site"

/**
 * Six-digit codes emailed to prove an address works, used when signing up
 * and when changing email. Stored hashed, in the email_otps table (read and
 * written with SQL so it works before the Prisma client is regenerated).
 *
 * - A code lasts OTP_TTL_MINUTES and allows MAX_ATTEMPTS guesses.
 * - A new code can be sent after RESEND_COOLDOWN_SECONDS, at most
 *   MAX_SENDS_PER_HOUR times an hour for the same sign-up email or account.
 */

export type OtpPurpose = "register" | "email-change"

export const OTP_TTL_MINUTES = 10
export const MAX_ATTEMPTS = 5
export const RESEND_COOLDOWN_SECONDS = 60
export const MAX_SENDS_PER_HOUR = 5

interface OtpRow {
  id: string
  purpose: OtpPurpose
  key: string
  email: string
  userId: string | null
  codeHash: string
  payload: unknown
  attempts: number
  sends: number
  expiresAt: Date
  lastSentAt: Date
  createdAt: Date
}

export class OtpError extends Error {
  constructor(message: string, public status: number, public retryAfter?: number) {
    super(message)
  }
}

function hashCode(purpose: OtpPurpose, key: string, code: string) {
  return crypto.createHmac("sha256", AUTH_SECRET ?? "tyro-study-otp").update(`${purpose}:${key}:${code}`).digest("hex")
}

function newCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0")
}

async function findOtp(purpose: OtpPurpose, key: string): Promise<OtpRow | null> {
  const [row] = await prisma.$queryRaw<OtpRow[]>`
    SELECT * FROM "email_otps" WHERE "purpose" = ${purpose} AND "key" = ${key}
  `
  return row ?? null
}

export async function deleteOtp(purpose: OtpPurpose, key: string) {
  await prisma.$executeRaw`DELETE FROM "email_otps" WHERE "purpose" = ${purpose} AND "key" = ${key}`
}

/** The pending email-change address for a user, if a code is waiting */
export async function pendingEmailChange(userId: string): Promise<string | null> {
  const row = await findOtp("email-change", userId)
  return row && row.expiresAt > new Date() ? row.email : null
}

function emailText(purpose: OtpPurpose, code: string) {
  const intro =
    purpose === "register"
      ? `Welcome to ${SITE_NAME}! Enter this code to confirm your email and finish creating your account:`
      : `Enter this code in ${SITE_NAME} to confirm your new email address:`
  const outro = `The code expires in ${OTP_TTL_MINUTES} minutes. If you didn't ask for it, you can ignore this email.`
  return {
    subject: purpose === "register" ? `${code} is your ${SITE_NAME} code` : `${code} confirms your new ${SITE_NAME} email`,
    text: `${intro}\n\n${code}\n\n${outro}`,
    html: codeEmailHtml({ intro, code, outro }),
  }
}

/**
 * Create (or replace) the code for this sign-up / email change and email it.
 * Throws OtpError(429) when asked again too soon or too often.
 */
export async function issueOtp({
  purpose,
  key,
  email,
  userId = null,
  payload = null,
}: {
  purpose: OtpPurpose
  key: string
  email: string
  userId?: string | null
  payload?: Record<string, unknown> | null
}) {
  const existing = await findOtp(purpose, key)
  const now = Date.now()
  let sends = 1
  if (existing) {
    // Limits apply per sign-up / per account, even when the address changes,
    // so nobody can use this to send lots of emails
    const since = (now - existing.lastSentAt.getTime()) / 1000
    if (since < RESEND_COOLDOWN_SECONDS) {
      const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - since)
      throw new OtpError(`Please wait ${wait} seconds before asking for another code.`, 429, wait)
    }
    const withinHour = now - existing.createdAt.getTime() < 60 * 60 * 1000
    if (withinHour && existing.sends >= MAX_SENDS_PER_HOUR) {
      throw new OtpError("Too many codes requested. Please try again in an hour.", 429, 3600)
    }
    sends = withinHour ? existing.sends + 1 : 1
  }

  const code = newCode()
  const codeHash = hashCode(purpose, key, code)
  const expiresAt = new Date(now + OTP_TTL_MINUTES * 60 * 1000)
  const payloadJson = payload ? JSON.stringify(payload) : null
  const keepCreated = !!existing && sends > 1

  await prisma.$executeRaw`
    INSERT INTO "email_otps" ("id", "purpose", "key", "email", "userId", "codeHash", "payload", "attempts", "sends", "expiresAt", "lastSentAt", "createdAt")
    VALUES (${crypto.randomUUID()}, ${purpose}, ${key}, ${email}, ${userId}, ${codeHash}, ${payloadJson}::jsonb, 0, ${sends}, ${expiresAt}, NOW(), NOW())
    ON CONFLICT ("purpose", "key") DO UPDATE SET
      "email" = EXCLUDED."email",
      "userId" = EXCLUDED."userId",
      "codeHash" = EXCLUDED."codeHash",
      "payload" = EXCLUDED."payload",
      "attempts" = 0,
      "sends" = EXCLUDED."sends",
      "expiresAt" = EXCLUDED."expiresAt",
      "lastSentAt" = NOW(),
      "createdAt" = CASE WHEN ${keepCreated} THEN "email_otps"."createdAt" ELSE NOW() END
  `

  try {
    await sendEmail({ to: email, ...emailText(purpose, code) })
  } catch (error) {
    await deleteOtp(purpose, key)
    console.error("Verification email error:", error)
    throw new OtpError("We couldn't send the code. Check the email address and try again.", 503)
  }
  return { email, expiresAt, resendIn: RESEND_COOLDOWN_SECONDS }
}

/** Ask again for the same sign-up / change, with a new code */
export async function resendOtp(purpose: OtpPurpose, key: string) {
  const existing = await findOtp(purpose, key)
  if (!existing) throw new OtpError("That code has expired. Start again.", 410)
  return issueOtp({
    purpose,
    key,
    email: existing.email,
    userId: existing.userId,
    payload: (existing.payload as Record<string, unknown> | null) ?? null,
  })
}

/**
 * Check a code. On success the code is used up and its row returned; wrong
 * codes count towards MAX_ATTEMPTS, after which the code stops working.
 */
export async function verifyOtp(purpose: OtpPurpose, key: string, code: string): Promise<OtpRow> {
  const row = await findOtp(purpose, key)
  if (!row || row.expiresAt <= new Date()) {
    if (row) await deleteOtp(purpose, key)
    throw new OtpError("That code has expired. Ask for a new one.", 410)
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    throw new OtpError("Too many wrong codes. Ask for a new one.", 429)
  }

  const clean = code.replace(/\D/g, "")
  const expected = Buffer.from(row.codeHash, "hex")
  const actual = Buffer.from(hashCode(purpose, key, clean), "hex")
  const ok = clean.length === 6 && expected.length === actual.length && crypto.timingSafeEqual(expected, actual)

  if (!ok) {
    await prisma.$executeRaw`UPDATE "email_otps" SET "attempts" = "attempts" + 1 WHERE "id" = ${row.id}`
    const left = MAX_ATTEMPTS - row.attempts - 1
    throw new OtpError(
      left > 0 ? `That code isn't right. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many wrong codes. Ask for a new one.",
      left > 0 ? 400 : 429
    )
  }

  await prisma.$executeRaw`DELETE FROM "email_otps" WHERE "id" = ${row.id}`
  return row
}

/** JSON error response body for an OtpError */
export function otpErrorBody(error: OtpError) {
  return { error: error.message, ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}) }
}
