import { NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { requireAdmin } from "@/lib/admin"

/** Images placed in lesson content from the admin editor (upload or paste) */

const MAX_IMAGE_SIZE = 8 * 1024 * 1024
const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
}

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required" }, { status: 400 })
  }

  const ext = TYPES[file.type]
  if (!ext) {
    return NextResponse.json({ error: "Use a PNG, JPG, GIF or WebP image" }, { status: 400 })
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: "Images must be 8MB or smaller" }, { status: 400 })
  }

  const base = file.name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "image"

  const blob = await put(`content-images/${Date.now()}-${base}.${ext}`, file, {
    access: "public",
    contentType: file.type,
  })

  return NextResponse.json({ url: blob.url }, { status: 201 })
}
