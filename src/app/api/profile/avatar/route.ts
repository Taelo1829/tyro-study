import { NextResponse } from "next/server"
import { del, put } from "@vercel/blob"
import { prisma } from "@/lib/prisma"
import { loadProfile, profileResponse, requireUserId } from "@/lib/profile"

/** Profile pictures: upload a new one (POST, form field "file") or remove it (DELETE) */

const MAX_SIZE = 4 * 1024 * 1024
const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
}

/** Delete the old picture from storage when it's one we uploaded */
async function removeOldAvatar(url: string | null | undefined) {
  if (!url || !/\.blob\.vercel-storage\.com\/avatars\//.test(url)) return
  try {
    await del(url)
  } catch (err) {
    console.error("Could not delete old profile picture:", err)
  }
}

export async function POST(request: Request) {
  const { userId, error } = await requireUserId()
  if (error) return error

  const formData = await request.formData().catch(() => null)
  const file = formData?.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image" }, { status: 400 })

  const ext = TYPES[file.type]
  if (!ext) return NextResponse.json({ error: "Use a PNG, JPG, WebP or GIF image" }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Pictures must be 4MB or smaller" }, { status: 400 })

  const before = await loadProfile(userId)
  if (!before) return NextResponse.json({ error: "Account not found" }, { status: 404 })

  const blob = await put(`avatars/${userId}-${Date.now()}.${ext}`, file, { access: "public", contentType: file.type })
  await prisma.user.update({ where: { id: userId }, data: { image: blob.url } })
  await removeOldAvatar(before.image)

  const updated = await loadProfile(userId)
  return NextResponse.json(await profileResponse(updated!), { status: 201 })
}

export async function DELETE() {
  const { userId, error } = await requireUserId()
  if (error) return error

  const before = await loadProfile(userId)
  if (!before) return NextResponse.json({ error: "Account not found" }, { status: 404 })

  await prisma.user.update({ where: { id: userId }, data: { image: null } })
  await removeOldAvatar(before.image)

  const updated = await loadProfile(userId)
  return NextResponse.json(await profileResponse(updated!))
}
