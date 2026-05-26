'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { MessageSquare } from 'lucide-react'
import {
  conversationChannel,
  EVENTS,
  subscribeToPusherChannel,
  unsubscribeFromPusherChannel,
  userChannel,
} from '@/lib/pusher'
import type { Conversation, ChatMessage, ChatUser } from './types'
import { cn } from '@/lib/utils'

interface ConversationListProps {
  currentUser: ChatUser
  selectedId: string | null
  onSelect: (conv: Conversation) => void
}

function Avatar({ user }: { user: ChatUser }) {
  return (
    <div className="w-11 h-11 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
      {user.image
        ? <img src={user.image} alt="" className="w-full h-full object-cover" />
        : (user.name?.charAt(0) ?? '?').toUpperCase()
      }
    </div>
  )
}

function lastMessagePreview(conv: Conversation, currentUserId: string) {
  const msg = conv.lastMessage
  if (!msg) return 'Start chatting'
  const prefix = msg.senderId === currentUserId ? 'You: ' : ''
  if (msg.type === 'VOICE') return `${prefix}🎤 Voice note`
  if (msg.type === 'IMAGE') return `${prefix}📷 Image`
  return `${prefix}${msg.content ?? ''}`
}

export function ConversationList({ currentUser, selectedId, onSelect }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/chat/conversations')
      .then(r => r.json())
      .then(data => { setConversations(data); setLoading(false) })
  }, [])

  // Real-time: when a friend accepts, add conversation
  useEffect(() => {
    const channelName = userChannel(currentUser.id)
    const channel = subscribeToPusherChannel(channelName)

    const handleFriendAccepted = () => {
      // Reload conversations to get the new one
      fetch('/api/chat/conversations')
        .then(r => r.json())
        .then(setConversations)
    }

    channel.bind(EVENTS.FRIEND_ACCEPTED, handleFriendAccepted)

    return () => {
      channel.unbind(EVENTS.FRIEND_ACCEPTED, handleFriendAccepted)
      unsubscribeFromPusherChannel(channelName)
    }
  }, [currentUser.id])

  // Bump conversation to top and update last message on new message
  const handleNewMessage = useCallback((conversationId: string, message: ChatMessage) => {
    setConversations(prev => {
      const existing = prev.find(c => c.id === conversationId)
      if (!existing) return prev

      const updated: Conversation = {
        ...existing,
        lastMessage: message,
        updatedAt: message.createdAt,
        unreadCount: message.senderId !== currentUser.id && conversationId !== selectedId
          ? existing.unreadCount + 1
          : existing.unreadCount,
      }
      return [updated, ...prev.filter(c => c.id !== conversationId)]
    })
  }, [currentUser.id, selectedId])

  const conversationKey = conversations.map(c => c.id).join(',')

  // Subscribe to all conversation channels for sidebar updates
  useEffect(() => {
    if (!conversationKey) return

    const unsubs = conversationKey.split(',').map(conversationId => {
      const channelName = conversationChannel(conversationId)
      const channel = subscribeToPusherChannel(channelName)
      const handleMessage = (msg: ChatMessage) => handleNewMessage(conversationId, msg)

      channel.bind(EVENTS.NEW_MESSAGE, handleMessage)

      return () => {
        channel.unbind(EVENTS.NEW_MESSAGE, handleMessage)
        unsubscribeFromPusherChannel(channelName)
      }
    })

    return () => unsubs.forEach(fn => fn())
  }, [conversationKey, handleNewMessage])

  // Clear unread when selecting
  function handleSelect(conv: Conversation) {
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c))
    onSelect(conv)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center py-14 text-center px-4">
        <MessageSquare className="w-10 h-10 text-muted-foreground/20 mb-3" />
        <p className="text-sm text-muted-foreground">No conversations yet</p>
        <p className="text-xs text-muted-foreground mt-1">Add friends to start chatting</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto divide-y divide-border">
      {conversations.map(conv => {
        const isSelected = conv.id === selectedId
        const preview = lastMessagePreview(conv, currentUser.id)

        return (
          <button
            key={conv.id}
            onClick={() => handleSelect(conv)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors',
              isSelected ? 'bg-primary/10' : 'hover:bg-muted/50',
            )}
          >
            <div className="relative">
              <Avatar user={conv.other} />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={cn('text-sm truncate', conv.unreadCount > 0 ? 'font-semibold' : 'font-medium')}>
                  {conv.other.name ?? conv.other.email}
                </p>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatDistanceToNowStrict(new Date(conv.updatedAt), { addSuffix: false })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className={cn('text-xs truncate', conv.unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                  {preview}
                </p>
                {conv.unreadCount > 0 && (
                  <span className="shrink-0 min-w-[18px] h-[18px] rounded-full gradient-primary bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
