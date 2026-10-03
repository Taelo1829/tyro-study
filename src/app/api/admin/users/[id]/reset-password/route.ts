import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { issuePasswordReset } from "@/lib/password-reset"

type Params = { params: Promise<{ id: string }> }

// POST /api/admin/users/:id/reset-password - admin only.
// Emails the user a password-reset link (the same link "Forgot password" sends).
export async function POST(_request: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const user = await prisma.user.findUnique({ where: { id }, select: { email: true } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  try {
    await issuePasswordReset(user.email)
  } catch (err) {
    console.error("Admin password reset error:", err)
    const message = err instanceof Error && err.message.includes("not configured")
      ? "Email isn't set up yet (RESEND_API_KEY / EMAIL_FROM)."
      : "Could not send the reset email."
    return NextResponse.json({ error: message }, { status: 503 })
  }

  return NextResponse.json({ success: true, email: user.email })
}
