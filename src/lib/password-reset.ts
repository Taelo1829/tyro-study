import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

export const PASSWORD_RESET_TOKEN_PREFIX = "password-reset:"
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000

export function hashPasswordResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export function getPasswordResetIdentifier(email: string) {
  return `${PASSWORD_RESET_TOKEN_PREFIX}${email.toLowerCase()}`
}

export function getAppUrl() {
  const configuredUrl = process.env.NEXTAUTH_URL ?? process.env.APP_URL
  if (configuredUrl) return configuredUrl.replace(/\/$/, "")

  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000"
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`
  await sendEmail({
    to: email,
    subject: "Reset your Tyro Study password",
    text: `Use this link to reset your password: ${resetUrl}\n\nThis link expires in one hour. If you did not request it, you can ignore this email.`,
  })
}

/**
 * Create a fresh reset token for this email (replacing any old one) and
 * email the link. Used by "Forgot password" and by admins in Manage users.
 */
export async function issuePasswordReset(email: string) {
  const identifier = getPasswordResetIdentifier(email)
  const token = crypto.randomBytes(32).toString("hex")
  await prisma.verificationToken.deleteMany({ where: { identifier } })
  await prisma.verificationToken.create({
    data: {
      identifier,
      token: hashPasswordResetToken(token),
      expires: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
    },
  })

  try {
    await sendPasswordResetEmail(email, token)
  } catch (error) {
    await prisma.verificationToken.deleteMany({ where: { identifier } })
    throw error
  }
}
