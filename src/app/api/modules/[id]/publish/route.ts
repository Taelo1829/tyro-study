import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { getModulePublishCounts, setModulePublished } from "@/lib/topic-publish"

type Params = { params: Promise<{ id: string }> }

/** How many of the module's topics are published (and actually showing publicly) */
export async function GET(_request: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error
  const { id } = await params
  return NextResponse.json(await getModulePublishCounts(id))
}

/** Publish or unpublish every topic in the module: { published: boolean } */
export async function POST(request: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as { published?: unknown }
  if (typeof body.published !== "boolean") {
    return NextResponse.json({ error: "Send { published: true | false }" }, { status: 400 })
  }
  try {
    const changed = await setModulePublished(id, body.published)
    return NextResponse.json({ changed, ...(await getModulePublishCounts(id)) })
  } catch {
    return NextResponse.json(
      { error: "Couldn't update publishing. Has `npx prisma migrate deploy` been run?" },
      { status: 500 }
    )
  }
}
