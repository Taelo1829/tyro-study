import { NextResponse } from "next/server"

// This was an early test endpoint that let anyone (even signed-out visitors)
// broadcast messages through the app's Pusher account. Nothing in the app
// uses it any more - chat goes through /api/chat/messages - so it is disabled.
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint has been removed. Use /api/chat/messages." },
    { status: 410 }
  )
}
