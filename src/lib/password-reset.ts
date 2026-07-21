import crypto from "crypto"

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
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    throw new Error("Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.")
  }

  const resetUrl = `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Reset your Tyro Study password",
      text: `Use this link to reset your password: ${resetUrl}\n\nThis link expires in one hour. If you did not request it, you can ignore this email.`,
    }),
  })

  if (!response.ok) {
    throw new Error(`Email provider returned ${response.status}`)
  }
}
