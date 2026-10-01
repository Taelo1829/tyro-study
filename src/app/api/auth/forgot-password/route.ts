import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { issuePasswordReset } from "@/lib/password-reset"

const SUCCESS_MESSAGE = "If an account exists for that email, a password reset link has been sent."

export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email?: string }
    const normalizedEmail = email?.trim().toLowerCase()

    if (!normalizedEmail) {
      return NextResponse.json({ error: "Enter your email address." }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { email: true, password: true },
    })

    // Always return the same response so this endpoint cannot reveal accounts.
    if (!user?.password) return NextResponse.json({ message: SUCCESS_MESSAGE })

    try {
      await issuePasswordReset(user.email)
    } catch (error) {
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
