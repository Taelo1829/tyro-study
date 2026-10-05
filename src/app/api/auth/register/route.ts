import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { EMAIL_PATTERN, NAME_MAX, PASSWORD_MIN } from "@/lib/profile"
import { OtpError, issueOtp, otpErrorBody } from "@/lib/email-otp"
import { isStudyLevel } from "@/lib/levels"

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
    if (password.length < PASSWORD_MIN || password.length > 200) {
      return NextResponse.json({ error: `Your password needs at least ${PASSWORD_MIN} characters` }, { status: 400 })
    }

    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const sent = await issueOtp({ purpose: "register", key: email, email, payload: { name, passwordHash, level: body.level } })
    return NextResponse.json({ pending: true, email: sent.email, resendIn: sent.resendIn }, { status: 202 })
  } catch (error) {
    if (error instanceof OtpError) return NextResponse.json(otpErrorBody(error), { status: error.status })
    console.error("Register error:", error)
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
