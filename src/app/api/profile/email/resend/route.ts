import { NextResponse } from "next/server"
import { requireUserId } from "@/lib/profile"
import { OtpError, otpErrorBody, resendOtp } from "@/lib/email-otp"

/** Email a new code for a pending email change */
export async function POST() {
  const { userId, error } = await requireUserId()
  if (error) return error
  try {
    const sent = await resendOtp("email-change", userId)
    return NextResponse.json({ email: sent.email, resendIn: sent.resendIn })
  } catch (err) {
    if (err instanceof OtpError) return NextResponse.json(otpErrorBody(err), { status: err.status })
    throw err
  }
}
