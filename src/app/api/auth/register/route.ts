import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { EMAIL_PATTERN, NAME_MAX, PASSWORD_MIN } from "@/lib/profile"
import { OtpError, RESEND_COOLDOWN_SECONDS, issueOtp, otpErrorBody } from "@/lib/email-otp"
import { HIGH_SCHOOL_PAUSED, isStudyLevel } from "@/lib/levels"
import { isEnabled } from "@/lib/flags"
import { track } from "@/lib/analytics"
import { captureError } from "@/lib/monitoring"
import { SIGNUP_NOTICE_PER_EMAIL, hit, limitKey } from "@/lib/rate-limit"
import { sendEmail } from "@/lib/email"
import { SITE_NAME, siteUrl } from "@/lib/site"

/**
 * Step 1 of signing up: check the details and email a 6-digit code.
 * The account is only created once the code is confirmed
 * (POST /api/auth/register/verify), so every account has a working email.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { name?: unknown; email?: unknown; password?: unknown; level?: unknown }
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body.password === "string" ? body.password : ""
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, NAME_MAX) : ""

    if (!EMAIL_PATTERN.test(email) || email.length > 200) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 })
    }
    if (!isStudyLevel(body.level)) {
      return NextResponse.json({ error: "Choose high school or university" }, { status: 400 })
    }
    if (body.level === "highschool" && !isEnabled("highschool_signup")) {
      return NextResponse.json({ error: HIGH_SCHOOL_PAUSED }, { status: 403 })
    }
    if (password.length < PASSWORD_MIN || password.length > 200) {
      return NextResponse.json({ error: `Your password needs at least ${PASSWORD_MIN} characters` }, { status: 400 })
    }

    // Hash first so both paths below take the same time (no timing hint).
    const passwordHash = await bcrypt.hash(password, 12)
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    })
    if (existing) {
      // Don't reveal that the address has an account (TS-055): answer exactly
      // like a new sign-up, and tell the owner by email instead.
      const notices = await hit(limitKey("signup-notice", email), SIGNUP_NOTICE_PER_EMAIL)
      if (notices <= SIGNUP_NOTICE_PER_EMAIL.limit) {
        await sendEmail({
          to: email,
          subject: `Your ${SITE_NAME} account`,
          text: `Someone (maybe you) tried to sign up for ${SITE_NAME} with this email address, but you already have an account.\n\nSign in: ${siteUrl()}/login\nForgot your password? ${siteUrl()}/forgot-password\n\nIf this wasn't you, you can ignore this email. Your account hasn't changed.`,
        }).catch(err => captureError("Sign-up notice email error", err, "/api/auth/register"))
      }
      return NextResponse.json({ pending: true, email, resendIn: RESEND_COOLDOWN_SECONDS }, { status: 202 })
    }

    const sent = await issueOtp({ purpose: "register", key: email, email, payload: { name, passwordHash, level: body.level } })
    track("sign_up_started", { props: { level: body.level } })
    return NextResponse.json({ pending: true, email: sent.email, resendIn: sent.resendIn }, { status: 202 })
  } catch (error) {
    if (error instanceof OtpError) return NextResponse.json(otpErrorBody(error), { status: error.status })
    captureError("Register error", error, "/api/auth/register")
    const code = error && typeof error === "object" && "code" in error ? String((error as { code: string }).code) : ""
    if (code === "ECONNREFUSED" || code === "P1001") {
      return NextResponse.json(
        { error: "Cannot connect to the database. Check DATABASE_URL and that PostgreSQL is running." },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: "Registration failed" }, { status: 500 })
  }
}
