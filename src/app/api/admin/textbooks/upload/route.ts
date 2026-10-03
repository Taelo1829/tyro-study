import { NextResponse } from "next/server"
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { requireAdmin } from "@/lib/admin"
import { MAX_TEXTBOOK_BYTES, TEXTBOOK_PREFIX } from "@/lib/ai/textbook"

/**
 * Lets an admin's browser upload a textbook PDF straight to Vercel Blob
 * (no 4.5MB request limit). Only admins get an upload token.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async pathname => {
        const { error } = await requireAdmin()
        if (error) throw new Error("Only admins can upload textbooks")
        if (!pathname.startsWith(TEXTBOOK_PREFIX)) throw new Error("Invalid upload path")
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_TEXTBOOK_BYTES,
          addRandomSuffix: true,
        }
      },
      // Nothing to record: the browser passes the file's URL on to /analyze
      onUploadCompleted: async () => {},
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 400 })
  }
}
