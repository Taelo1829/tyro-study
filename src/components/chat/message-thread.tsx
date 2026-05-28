'use client'

import { useState, useEffect, useRef } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { Check, CheckCheck, Reply } from 'lucide-react'
import { VoiceNote } from './voice-note'
import { MessageInput } from './message-input'
import {
  conversationChannel,
  EVENTS,
  subscribeToPusherChannel,
  unsubscribeFromPusherChannel,
} from '@/lib/pusher'
import type { ChatMessage, ChatUser } from './types'
import type { ChatMessageReply } from './types'
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

function getMessagePreview(message: ChatMessage | ChatMessageReply) {
  if (message.type === 'VOICE') return 'Voice note'
  if (message.type === 'IMAGE') return 'Image'
  return message.content ?? 'Message'
}

function toReplyPreview(message: ChatMessage): ChatMessageReply {
  return {
    id: message.id,
    senderId: message.senderId,
    type: message.type,
    content: message.content,
    mediaUrl: message.mediaUrl,
    mediaDuration: message.mediaDuration,
    sender: message.sender,
  }
}

function QuotedMessage({ message, isMine }: { message: ChatMessageReply; isMine: boolean }) {
  return (
    <div
      className={cn(
        'w-full max-w-xs rounded-lg border-l-4 px-3 py-2 text-xs',
        isMine
          ? 'border-primary-foreground/70 bg-primary-foreground/10 text-primary-foreground'
          : 'border-primary bg-background/80 text-foreground',
      )}
    >
      <p className={cn('truncate font-semibold', isMine ? 'text-primary-foreground' : 'text-primary')}>
        {message.sender.name ?? message.sender.email}
      </p>
      <p className={cn('mt-0.5 truncate', isMine ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
        {getMessagePreview(message)}
      </p>
    </div>
  )
}

function MessageBubble({
  msg,
  isMine,
  onReply,
}: {
  msg: ChatMessage
  isMine: boolean
  onReply: (message: ChatMessage) => void
}) {
  const [dragX, setDragX] = useState(0)
  const dragRef = useRef({
    active: false,
    currentX: 0,
    startX: 0,
    startY: 0,
    swiping: false,
  })
  const replyOpacity = Math.min(Math.abs(dragX) / 64, 1)

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    dragRef.current = {
      active: true,
      currentX: 0,
      startX: event.clientX,
      startY: event.clientY,
      swiping: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag.active) return

    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY

    if (!drag.swiping && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      drag.swiping = true
    }

    if (!drag.swiping) return

    event.preventDefault()
    const nextDragX = Math.max(-84, Math.min(84, dx))
    drag.currentX = nextDragX
    setDragX(nextDragX)
  }

  function endSwipe() {
    const shouldReply = Math.abs(dragRef.current.currentX) >= 64
    dragRef.current.active = false
    dragRef.current.currentX = 0
    dragRef.current.swiping = false
    setDragX(0)

    if (shouldReply) {
      onReply(msg)
    }
  }

  return (
    <div
      className={cn('relative flex gap-2 group', isMine ? 'flex-row-reverse' : 'flex-row')}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endSwipe}
      onPointerCancel={endSwipe}
      style={{ touchAction: 'pan-y' }}
    >
      <div
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-primary/10 p-2 text-primary transition-opacity',
          dragX < 0 ? 'right-2' : 'left-2',
        )}
        style={{ opacity: replyOpacity }}
      >
        <Reply className="h-4 w-4" />
      </div>

      <div
        className={cn(
          'max-w-[70%] space-y-0.5 transition-transform',
          isMine ? 'items-end' : 'items-start',
          'flex flex-col',
        )}
        style={{ transform: `translateX(${dragX}px)` }}
      >
        {msg.replyTo && <QuotedMessage message={msg.replyTo} isMine={isMine} />}

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
  const [replyState, setReplyState] = useState<{
    conversationId: string
    message: ChatMessage
  } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstLoad = useRef(true)
  const replyTo = replyState?.conversationId === conversationId ? replyState.message : null

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
    replyToId?: string
  }) {
    const temporaryMessage: ChatMessage = {
      content: payload.content!,
      conversationId: conversationId,
      createdAt: new Date().toISOString(),
      id: "temporaryId" + new Date(),
      mediaDuration: payload.mediaDuration!,
      mediaUrl: payload.mediaUrl!,
      replyToId: payload.replyToId ?? null,
      replyTo: replyTo && payload.replyToId === replyTo.id ? toReplyPreview(replyTo) : null,
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
              onReply={(message) => setReplyState({ conversationId, message })}
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
        onSend={handleSend}
        replyTo={replyTo}
        onCancelReply={() => setReplyState(null)}
        disabled={sending}
      />
    </div>
  )
}
