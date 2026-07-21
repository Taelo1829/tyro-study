import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  hashPasswordResetToken,
  PASSWORD_RESET_TOKEN_PREFIX,
} from "@/lib/password-reset"

export async function POST(request: Request) {
  try {
    const { token, password } = (await request.json()) as { token?: string; password?: string }
    if (!token || !password || password.length < 8) {
      return NextResponse.json({ error: "A valid token and an 8+ character password are required." }, { status: 400 })
    }

    const hashedToken = hashPasswordResetToken(token)
    const resetToken = await prisma.verificationToken.findUnique({ where: { token: hashedToken } })
    if (
      !resetToken ||
      !resetToken.identifier.startsWith(PASSWORD_RESET_TOKEN_PREFIX) ||
      resetToken.expires <= new Date()
    ) {
      if (resetToken) await prisma.verificationToken.delete({ where: { token: hashedToken } })
      return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 })
    }

    const email = resetToken.identifier.slice(PASSWORD_RESET_TOKEN_PREFIX.length)
    const passwordHash = await bcrypt.hash(password, 12)
    await prisma.$transaction([
      prisma.user.update({ where: { email }, data: { password: passwordHash } }),
      prisma.verificationToken.delete({ where: { token: hashedToken } }),
    ])

    return NextResponse.json({ message: "Your password has been reset. You can now sign in." })
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json({ error: "Unable to reset your password." }, { status: 500 })
  }
}
