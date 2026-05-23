import { pusherServer } from "@/lib/pusher"

export async function POST(req: any) {
  const body = await req.json()

  await pusherServer.trigger(
    "chat-channel",
    "new-message",
    {
      text: body.text,
      createdAt: new Date()
    }
  )

  return Response.json({
    success: true
  })
}