import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { pendingEmailChange } from "@/lib/email-otp"

/** What the profile page shows about the signed-in user */
export const PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
  role: true,
  createdAt: true,
  password: true,
} as const

export type ProfileRow = Awaited<ReturnType<typeof loadProfile>>

export async function loadProfile(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT })
}

/** The profile without the password hash */
export function publicProfile(user: NonNullable<ProfileRow>) {
  const { password, ...rest } = user
  return { ...rest, hasPassword: !!password }
}

/** The profile plus any email change waiting for its code */
export async function profileResponse(user: NonNullable<ProfileRow>) {
  return { ...publicProfile(user), pendingEmail: await pendingEmailChange(user.id) }
}

/** The signed-in user's id, or a 401 response */
export async function requireUserId(): Promise<{ userId: string; error?: never } | { userId?: never; error: NextResponse }> {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return { error: NextResponse.json({ error: "Please sign in" }, { status: 401 }) }
  return { userId }
}

export const NAME_MAX = 60
export const PASSWORD_MIN = 8
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
