import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { PASSWORD_MIN, loadProfile, requireUserId } from "@/lib/profile"

/** Change the signed-in user's password (needs the current one) */
export async function POST(request: Request) {
  const { userId, error } = await requireUserId()
  if (error) return error

  const body = (await request.json().catch(() => ({}))) as { currentPassword?: unknown; newPassword?: unknown }
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : ""
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""

  const user = await loadProfile(userId)
  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 })

  if (user.password && !(currentPassword && (await bcrypt.compare(currentPassword, user.password)))) {
    return NextResponse.json({ error: "Your current password is wrong", field: "currentPassword" }, { status: 400 })
  }
  if (newPassword.length < PASSWORD_MIN) {
    return NextResponse.json({ error: `Your new password needs at least ${PASSWORD_MIN} characters`, field: "newPassword" }, { status: 400 })
  }
  if (newPassword.length > 200) {
    return NextResponse.json({ error: "That password is too long", field: "newPassword" }, { status: 400 })
  }
  if (user.password && (await bcrypt.compare(newPassword, user.password))) {
    return NextResponse.json({ error: "Choose a password that's different from your current one", field: "newPassword" }, { status: 400 })
  }

  await prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(newPassword, 12) } })
  return NextResponse.json({ ok: true })
}
