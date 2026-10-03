import { NextResponse } from "next/server"
import { OtpError, otpErrorBody, resendOtp } from "@/lib/email-otp"

/** Email a new sign-up code */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: unknown }
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 })
    const sent = await resendOtp("register", email)
    return NextResponse.json({ email: sent.email, resendIn: sent.resendIn })
  } catch (error) {
    if (error instanceof OtpError) return NextResponse.json(otpErrorBody(error), { status: error.status })
    console.error("Register resend error:", error)
    return NextResponse.json({ error: "Couldn't send a new code" }, { status: 500 })
  }
}
