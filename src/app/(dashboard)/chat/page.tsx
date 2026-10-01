import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

import { redirect } from "next/navigation"
import { ChatLayout } from "@/components/chat/chat-layout"

export const metadata = {
  title: "Chat",
}

export default async function ChatPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  const currentUser = {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? "",
    image: session.user.image ?? null,
    role: session.user.role ?? undefined,
  }

  return (
    <div className="h-[calc(100dvh-13rem)] sm:h-[calc(100dvh-14rem)] lg:h-[calc(100dvh-9.5rem)]">
      <ChatLayout currentUser={currentUser} />
    </div>
  )
}
