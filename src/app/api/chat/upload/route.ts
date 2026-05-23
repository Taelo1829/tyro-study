import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024  // 5 MB
const MAX_VOICE_SIZE = 10 * 1024 * 1024 // 10 MB

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const ALLOWED_VOICE_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const type = formData.get('type') as 'image' | 'voice' | null

  if (!file || !type) {
    return NextResponse.json({ error: 'file and type required' }, { status: 400 })
  }

  const isImage = type === 'image'
  const isVoice = type === 'voice'
  const fileType = file.type?.split(";")[0]
  if (isImage && !ALLOWED_IMAGE_TYPES.includes(fileType)) {
    return NextResponse.json({ error: 'Invalid image type' }, { status: 400 })
  }

  if (isVoice && !ALLOWED_VOICE_TYPES.includes(fileType)) {
    return NextResponse.json({ error: 'Invalid audio type, you supplied a ' + fileType }, { status: 400 })
  }

  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VOICE_SIZE
  if (file.size > maxSize) {
    return NextResponse.json({
      error: `File too large (max ${maxSize / 1024 / 1024}MB)`,
    }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? (isImage ? 'jpg' : 'webm')
  const filename = `chat/${type}s/${session.user.id}/${Date.now()}.${ext}`

  const { url } = await put(filename, file, {
    access: 'public',
    contentType: file.type,
  })

  return NextResponse.json({ url })
}
