"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { conversationChannel, EVENTS, getPusherClient, userChannel } from "@/lib/pusher"
import type { ChatMessage } from "@/components/chat/types"

interface ConversationUnreadState {
  id: string
  unreadCount: number
}

async function fetchConversationUnreadState() {
  const res = await fetch("/api/chat/conversations")
  if (!res.ok) return null

  const conversations = (await res.json()) as ConversationUnreadState[]
  return {
    conversationIds: conversations.map((conversation) => conversation.id),
    unreadIds: conversations
      .filter((conversation) => conversation.unreadCount > 0)
      .map((conversation) => conversation.id),
  }
}

function getMessagePreview(message: ChatMessage) {
  if (message.type === "VOICE") return "Sent a voice note"
  if (message.type === "IMAGE") return "Sent an image"
  return message.content ?? "Sent a message"
}

function showChatNotification(message: ChatMessage, conversationId: string, pathname: string | null) {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "granted") return
  if (pathname?.startsWith("/chat") && document.visibilityState === "visible") return

  const storageKey = `shown-chat-notification:${message.id}`
  if (window.sessionStorage.getItem(storageKey)) return
  window.sessionStorage.setItem(storageKey, "true")

  const notification = new Notification(message.sender?.name ?? "New chat message", {
    body: getMessagePreview(message),
    icon: "/icons/icon-192.png",
    tag: `chat-${conversationId}`,
  })

  notification.onclick = () => {
    window.focus()
    window.location.href = "/chat"
    notification.close()
  }
}

export function useChatUnreadCount() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const userId = session?.user?.id
  const [conversationIds, setConversationIds] = useState<string[]>([])
  const [unreadConversationIds, setUnreadConversationIds] = useState<string[]>([])

  const refresh = useCallback(async () => {
    if (!userId) {
      setConversationIds([])
      setUnreadConversationIds([])
      return
    }

    const nextState = await fetchConversationUnreadState()
    if (!nextState) return

    setConversationIds(nextState.conversationIds)
    setUnreadConversationIds(nextState.unreadIds)
  }, [userId])

  useEffect(() => {
    if (!userId) {
      return
    }

    let cancelled = false

    fetchConversationUnreadState().then((nextState) => {
      if (!cancelled && nextState) {
        setConversationIds(nextState.conversationIds)
        setUnreadConversationIds(nextState.unreadIds)
      }
    })

    return () => {
      cancelled = true
    }
  }, [pathname, userId])

  useEffect(() => {
    if (!userId) return

    const pusher = getPusherClient()
    const channelName = userChannel(userId)
    const channel = pusher.subscribe(channelName)

    channel.bind(EVENTS.NEW_MESSAGE, refresh)
    channel.bind(EVENTS.MESSAGE_READ, refresh)
    channel.bind(EVENTS.FRIEND_ACCEPTED, refresh)

    return () => {
      channel.unbind(EVENTS.NEW_MESSAGE, refresh)
      channel.unbind(EVENTS.MESSAGE_READ, refresh)
      channel.unbind(EVENTS.FRIEND_ACCEPTED, refresh)
      pusher.unsubscribe(channelName)
    }
  }, [refresh, userId])

  useEffect(() => {
    if (!userId || conversationIds.length === 0) return

    const pusher = getPusherClient()
    const uniqueConversationIds = Array.from(new Set(conversationIds))

    const unsubs = uniqueConversationIds.map((conversationId) => {
      const channelName = conversationChannel(conversationId)
      const channel = pusher.subscribe(channelName)

      const handleNewMessage = (message: ChatMessage) => {
        if (message.senderId === userId) return

        showChatNotification(message, conversationId, pathname)

        setUnreadConversationIds((current) => {
          const unreadIds = new Set(current)
          unreadIds.add(conversationId)
          return Array.from(unreadIds)
        })
      }

      const handleRead = (payload: { userId?: string; conversationId?: string }) => {
        if (payload.userId && payload.userId !== userId) return

        setUnreadConversationIds((current) => {
          const unreadIds = new Set(current)
          unreadIds.delete(payload.conversationId ?? conversationId)
          return Array.from(unreadIds)
        })
      }

      channel.bind(EVENTS.NEW_MESSAGE, handleNewMessage)
      channel.bind(EVENTS.MESSAGE_READ, handleRead)

      return () => {
        channel.unbind(EVENTS.NEW_MESSAGE, handleNewMessage)
        channel.unbind(EVENTS.MESSAGE_READ, handleRead)
        pusher.unsubscribe(channelName)
      }
    })

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe())
    }
  }, [conversationIds, pathname, userId])

  return unreadConversationIds.length
}
