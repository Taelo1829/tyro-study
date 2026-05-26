'use client'

import { useState, useEffect, useRef } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { Check, CheckCheck } from 'lucide-react'
import { VoiceNote } from './voice-note'
import { MessageInput } from './message-input'
import {
  conversationChannel,
  EVENTS,
  subscribeToPusherChannel,
  unsubscribeFromPusherChannel,
} from '@/lib/pusher'
import type { ChatMessage, ChatUser } from './types'
import { cn } from '@/lib/utils'

interface MessageThreadProps {
  conversationId: string
  currentUser: ChatUser
  otherUser: ChatUser
}

function formatTime(date: string) {
  const d = new Date(date)
  if (isToday(d)) return format(d, 'HH:mm')
  if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`
  return format(d, 'dd MMM HH:mm')
}

function DateDivider({ date }: { date: string }) {
  const d = new Date(date)
  const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'dd MMMM yyyy')
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground font-medium px-2">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

function MessageBubble({ msg, isMine }: { msg: ChatMessage; isMine: boolean }) {
  return (
    <div className={cn('flex gap-2 group', isMine ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn('max-w-[70%] space-y-0.5', isMine ? 'items-end' : 'items-start', 'flex flex-col')}>

        {msg.type === 'TEXT' && (
          <div className={cn(
            'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
            isMine
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-muted text-foreground rounded-bl-sm',
          )}>
            {msg.content}
          </div>
        )}

        {msg.type === 'IMAGE' && msg.mediaUrl && (
          <img
            src={msg.mediaUrl}
            alt="Image"
            className="max-w-xs max-h-72 rounded-2xl object-cover cursor-pointer hover:opacity-95 transition-opacity"
            onClick={() => window.open(msg.mediaUrl!, '_blank')}
          />
        )}

        {msg.type === 'VOICE' && msg.mediaUrl && (
          <VoiceNote url={msg.mediaUrl} duration={msg.mediaDuration} isMine={isMine} />
        )}

        {/* Time + read receipt */}
        <div className={cn(
          'flex items-center gap-1 px-1',
          isMine ? 'flex-row-reverse' : 'flex-row',
        )}>
          <span className="text-[10px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
          {isMine && (
            msg.pending ? <span className="text-[10px] text-muted-foreground">Sending...</span> :
              msg.readAt
                ? <CheckCheck className="w-3 h-3 text-primary" />
                : <Check className="w-3 h-3 text-muted-foreground" />
          )}
        </div>
      </div>
    </div>
  )
}

export function MessageThread({ conversationId, currentUser }: MessageThreadProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [typingName, setTypingName] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstLoad = useRef(true)

  useEffect(() => {
    fetch(`/api/chat/messages?conversationId=${conversationId}`)
      .then(r => r.json())
      .then(data => {
        setMessages(data.messages)
        setHasMore(data.hasMore)
        setNextCursor(data.nextCursor)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 50)
        isFirstLoad.current = false
      })

    fetch('/api/chat/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    })
  }, [conversationId])

  useEffect(() => {
    const channelName = conversationChannel(conversationId)
    const channel = subscribeToPusherChannel(channelName)

    const handleNewMessage = (msg: ChatMessage) => {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

      if (msg.senderId !== currentUser.id) {
        fetch('/api/chat/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId }),
        })
      }
    }

    const handleTypingStart = (data: { userId: string; name: string }) => {
      if (data.userId !== currentUser.id) {
        setTypingName(data.name)
        if (typingTimer.current) clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setTypingName(null), 3000)
      }
    }

    const handleTypingStop = (data: { userId: string }) => {
      if (data.userId !== currentUser.id) setTypingName(null)
    }

    const handleMessageRead = () => {
      setMessages(prev => prev.map(m =>
        m.senderId === currentUser.id && !m.readAt
          ? { ...m, readAt: new Date().toISOString() }
          : m
      ))
    }

    channel.bind(EVENTS.NEW_MESSAGE, handleNewMessage)
    channel.bind(EVENTS.TYPING_START, handleTypingStart)
    channel.bind(EVENTS.TYPING_STOP, handleTypingStop)
    channel.bind(EVENTS.MESSAGE_READ, handleMessageRead)

    return () => {
      channel.unbind(EVENTS.NEW_MESSAGE, handleNewMessage)
      channel.unbind(EVENTS.TYPING_START, handleTypingStart)
      channel.unbind(EVENTS.TYPING_STOP, handleTypingStop)
      channel.unbind(EVENTS.MESSAGE_READ, handleMessageRead)
      if (typingTimer.current) clearTimeout(typingTimer.current)
      unsubscribeFromPusherChannel(channelName)
    }
  }, [conversationId, currentUser.id])

  async function loadMore() {
    if (!hasMore || loadingMore || !nextCursor) return
    setLoadingMore(true)
    const prevScrollHeight = topRef.current?.parentElement?.scrollHeight ?? 0

    const res = await fetch(`/api/chat/messages?conversationId=${conversationId}&cursor=${nextCursor}`)
    const data = await res.json()

    setMessages(prev => [...data.messages, ...prev])
    setHasMore(data.hasMore)
    setNextCursor(data.nextCursor)
    setLoadingMore(false)

    // Maintain scroll position
    requestAnimationFrame(() => {
      const el = topRef.current?.parentElement
      if (el) el.scrollTop = el.scrollHeight - prevScrollHeight
    })
  }

  async function handleSend(payload: {
    type: 'TEXT' | 'IMAGE' | 'VOICE'
    content?: string
    mediaUrl?: string
    mediaDuration?: number
  }) {
    const temporaryMessage: ChatMessage = {
      content: payload.content!,
      conversationId: conversationId,
      createdAt: new Date().toISOString(),
      id: "temporaryId" + new Date(),
      mediaDuration: payload.mediaDuration!,
      mediaUrl: payload.mediaUrl!,
      readAt: null,
      pending: true,
      type: payload.type,
      senderId: currentUser.id,
      sender: {
        id: currentUser.id,
        name: currentUser.name,
        image: currentUser.image,
        email: currentUser.email
      }
    }

    setMessages(prev => [...prev, temporaryMessage])
    setSending(true)
    try {
      await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, ...payload }),
      })
    } finally {
      setMessages(prev => prev.filter(m => !m.pending))
      setSending(false)
    }
  }

  const grouped: Array<ChatMessage | string> = []
  let lastDate = ''
  for (const msg of messages) {
    const day = format(new Date(msg.createdAt), 'yyyy-MM-dd')
    if (day !== lastDate) { grouped.push(day); lastDate = day }
    grouped.push(msg)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        <div ref={topRef} />

        {hasMore && (
          <div className="flex justify-center pb-2">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-xs text-primary hover:underline disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load older messages'}
            </button>
          </div>
        )}

        {grouped.map((item) => {
          if (typeof item === 'string') return <DateDivider key={item} date={item + 'T00:00:00'} />
          return (
            <MessageBubble
              key={item.id}
              msg={item}
              isMine={item.senderId === currentUser.id}
            />
          )
        })}

        {typingName && (
          <div className="flex items-center gap-2 px-1">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{typingName} is typing…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <MessageInput
        conversationId={conversationId}
        onSend={handleSend}
        disabled={sending}
      />
    </div>
  )
}
