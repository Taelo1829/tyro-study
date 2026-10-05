import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { OtpError, otpErrorBody, verifyOtp } from "@/lib/email-otp"
import { asLevel } from "@/lib/levels"
import { setUserLevel } from "@/lib/levels-server"

/** Step 2 of signing up: confirm the emailed code, then create the account */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: unknown; code?: unknown }
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const code = typeof body.code === "string" ? body.code : ""
    if (!email || !code) return NextResponse.json({ error: "Enter the 6-digit code" }, { status: 400 })

    const otp = await verifyOtp("register", email, code)
    const { name, passwordHash, level } = (otp.payload ?? {}) as { name?: string; passwordHash?: string; level?: string }
    if (!passwordHash) return NextResponse.json({ error: "Please sign up again" }, { status: 410 })

    const user = await prisma.user.create({
      data: { name: name || null, email, password: passwordHash, emailVerified: new Date(), lastSeen: new Date() },
      select: { id: true, email: true, name: true },
    })
    // High school or university (best effort: before its migration everyone is university)
    await setUserLevel(user.id, asLevel(level)).catch(err => console.warn("Couldn't save the study level:", err instanceof Error ? err.message : err))
    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    if (error instanceof OtpError) return NextResponse.json(otpErrorBody(error), { status: error.status })
    // Someone finished signing up with this email in the meantime
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Email already registered. Try signing in." }, { status: 409 })
    }
    console.error("Register verify error:", error)
    return NextResponse.json({ error: "Couldn't create your account" }, { status: 500 })
  }
}
