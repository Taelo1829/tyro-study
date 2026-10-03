import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { EMAIL_PATTERN, NAME_MAX, loadProfile, profileResponse, requireUserId } from "@/lib/profile"
import { OtpError, deleteOtp, issueOtp, otpErrorBody } from "@/lib/email-otp"

/** The signed-in user's profile */
export async function GET() {
  const { userId, error } = await requireUserId()
  if (error) return error
  const user = await loadProfile(userId)
  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 })
  return NextResponse.json(await profileResponse(user))
}

/**
 * Update name and/or email. A new email (the sign-in name) needs the current
 * password and must not belong to another account; it only takes effect once
 * the 6-digit code emailed to it is confirmed (POST /api/profile/email).
 */
export async function PATCH(request: Request) {
  const { userId, error } = await requireUserId()
  if (error) return error

  const body = (await request.json().catch(() => ({}))) as { name?: unknown; email?: unknown; currentPassword?: unknown }
  const user = await loadProfile(userId)
  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 })

  const data: { name?: string } = {}
  let newEmail: string | null = null

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : ""
    if (name.length < 2) return NextResponse.json({ error: "Your name needs at least 2 characters" }, { status: 400 })
    if (name.length > NAME_MAX) return NextResponse.json({ error: `Keep your name under ${NAME_MAX} characters` }, { status: 400 })
    data.name = name
  }

  if (body.email !== undefined) {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    if (!EMAIL_PATTERN.test(email) || email.length > 200) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 })
    }
    if (email !== user.email.toLowerCase()) {
      const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : ""
      if (!user.password || !currentPassword || !(await bcrypt.compare(currentPassword, user.password))) {
        return NextResponse.json({ error: "Enter your current password to change your email", field: "currentPassword" }, { status: 400 })
      }
      const taken = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" }, NOT: { id: userId } },
        select: { id: true },
      })
      if (taken) return NextResponse.json({ error: "Another account already uses that email", field: "email" }, { status: 409 })
      newEmail = email
    } else {
      // Back to the current email: drop any change that was waiting for a code
      await deleteOtp("email-change", userId)
    }
  }

  if (data.name !== undefined && data.name !== user.name) {
    await prisma.user.update({ where: { id: userId }, data })
  }

  let codeSent = false
  if (newEmail) {
    try {
      await issueOtp({ purpose: "email-change", key: userId, email: newEmail, userId })
      codeSent = true
    } catch (err) {
      if (err instanceof OtpError) return NextResponse.json(otpErrorBody(err), { status: err.status })
      throw err
    }
  }

  const updated = await loadProfile(userId)
  return NextResponse.json({ ...(await profileResponse(updated!)), codeSent })
}
