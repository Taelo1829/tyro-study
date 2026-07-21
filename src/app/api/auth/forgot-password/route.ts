import crypto from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  getPasswordResetIdentifier,
  hashPasswordResetToken,
  PASSWORD_RESET_TOKEN_TTL_MS,
  sendPasswordResetEmail,
} from "@/lib/password-reset"

const SUCCESS_MESSAGE = "If an account exists for that email, a password reset link has been sent."

export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email?: string }
    const normalizedEmail = email?.trim().toLowerCase()

    if (!normalizedEmail) {
      return NextResponse.json({ error: "Enter your email address." }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { email: true, password: true },
    })

    // Always return the same response so this endpoint cannot reveal accounts.
    if (!user?.password) return NextResponse.json({ message: SUCCESS_MESSAGE })

    const identifier = getPasswordResetIdentifier(user.email)
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
      await sendPasswordResetEmail(user.email, token)
    } catch (error) {
      await prisma.verificationToken.deleteMany({ where: { identifier } })
      console.error("Password reset email error:", error)
      return NextResponse.json(
        { error: "We could not send the reset email. Please try again later." },
        { status: 503 }
      )
    }

    return NextResponse.json({ message: SUCCESS_MESSAGE })
  } catch (error) {
    console.error("Forgot password error:", error)
    return NextResponse.json({ error: "Unable to process your request." }, { status: 500 })
  }
}
