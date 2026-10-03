import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { loadProfile, profileResponse, requireUserId } from "@/lib/profile"
import { OtpError, deleteOtp, otpErrorBody, verifyOtp } from "@/lib/email-otp"

/** Confirm a new email with the 6-digit code sent to it, then switch to it */
export async function POST(request: Request) {
  const { userId, error } = await requireUserId()
  if (error) return error

  const body = (await request.json().catch(() => ({}))) as { code?: unknown }
  const code = typeof body.code === "string" ? body.code : ""
  if (!code) return NextResponse.json({ error: "Enter the 6-digit code" }, { status: 400 })

  try {
    const otp = await verifyOtp("email-change", userId, code)
    const taken = await prisma.user.findFirst({
      where: { email: { equals: otp.email, mode: "insensitive" }, NOT: { id: userId } },
      select: { id: true },
    })
    if (taken) return NextResponse.json({ error: "Another account now uses that email" }, { status: 409 })

    await prisma.user.update({ where: { id: userId }, data: { email: otp.email, emailVerified: new Date() } })
    const updated = await loadProfile(userId)
    return NextResponse.json(await profileResponse(updated!))
  } catch (err) {
    if (err instanceof OtpError) return NextResponse.json(otpErrorBody(err), { status: err.status })
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Another account now uses that email" }, { status: 409 })
    }
    throw err
  }
}

/** Cancel a pending email change */
export async function DELETE() {
  const { userId, error } = await requireUserId()
  if (error) return error
  await deleteOtp("email-change", userId)
  const user = await loadProfile(userId)
  return NextResponse.json(await profileResponse(user!))
}
