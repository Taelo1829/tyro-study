'use client'

import { useState, useRef } from 'react'
import { Send, Image as ImageIcon, Mic, X, Loader2, Reply } from 'lucide-react'
import { VoiceRecorder } from './voice-recorder'
import { cn } from '@/lib/utils'
import type { ChatMessage, ChatMessageReply, MessageType } from './types'

interface SendMessagePayload {
  type: MessageType
  content?: string
  mediaUrl?: string
  mediaDuration?: number
  replyToId?: string
}

interface MessageInputProps {
  onSend: (payload: SendMessagePayload) => void
  replyTo?: ChatMessage | null
  onCancelReply?: () => void
  disabled?: boolean
}

function getReplyPreview(message: ChatMessage | ChatMessageReply) {
  if (message.type === 'VOICE') return 'Voice note'
  if (message.type === 'IMAGE') return 'Image'
  return message.content ?? 'Message'
}

function ReplyPreview({
  message,
  onCancel,
}: {
  message: ChatMessage
  onCancel?: () => void
}) {
  return (
    <div className="mb-2 flex items-stretch overflow-hidden rounded-lg border border-border bg-muted/60">
      <div className="w-1 shrink-0 bg-primary" />
      <div className="min-w-0 flex-1 px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Reply className="h-3.5 w-3.5" />
          <span>{message.sender.name ?? message.sender.email}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {getReplyPreview(message)}
        </p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="flex w-9 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label="Cancel reply"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function MessageInput({ onSend, replyTo, onCancelReply, disabled }: MessageInputProps) {
  const [text, setText] = useState('')
  const [showVoice, setShowVoice] = useState(false)
  const [imagePreview, setImagePreview] = useState<{ url: string; file: File } | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Typing indicator ───────────────────────────────────────────────────────
  function handleTextChange(val: string) {
    setText(val)
  }

  // ── Send text ──────────────────────────────────────────────────────────────
  function handleSendText() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend({ type: 'TEXT', content: trimmed, replyToId: replyTo?.id })
    setText('')
    onCancelReply?.()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendText()
    }
  }

  // ── Image upload ───────────────────────────────────────────────────────────
  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const preview = URL.createObjectURL(file)
    setImagePreview({ url: preview, file })
  }

  async function handleSendImage() {
    if (!imagePreview || disabled) return
    setUploading(true)

    try {
      const fd = new FormData()
      fd.append('file', imagePreview.file)
      fd.append('type', 'image')

      const res = await fetch('/api/chat/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const { url } = await res.json()

      onSend({ type: 'IMAGE', mediaUrl: url, replyToId: replyTo?.id })
      URL.revokeObjectURL(imagePreview.url)
      setImagePreview(null)
      onCancelReply?.()
    } catch {
      // Keep preview so user can retry
    } finally {
      setUploading(false)
    }
  }

  // ── Voice note ─────────────────────────────────────────────────────────────
  async function handleVoiceSend(blob: Blob, duration: number) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', blob, 'voice.webm')
      fd.append('type', 'voice')

      const res = await fetch('/api/chat/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const { url } = await res.json()

      onSend({ type: 'VOICE', mediaUrl: url, mediaDuration: duration, replyToId: replyTo?.id })
      setShowVoice(false)
      onCancelReply?.()
    } catch {
      setShowVoice(false)
    } finally {
      setUploading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (showVoice) {
    return (
      <div className="p-3 border-t border-border bg-background">
        {replyTo && <ReplyPreview message={replyTo} onCancel={onCancelReply} />}
        <VoiceRecorder
          onSend={handleVoiceSend}
          onCancel={() => setShowVoice(false)}
          disabled={uploading}
        />
      </div>
    )
  }

  if (imagePreview) {
    return (
      <div className="p-3 border-t border-border bg-background space-y-2">
        {replyTo && <ReplyPreview message={replyTo} onCancel={onCancelReply} />}
        <div className="relative w-32">
          <img
            src={imagePreview.url}
            alt="Preview"
            className="w-32 h-32 object-cover rounded-xl border border-border"
          />
          <button
            onClick={() => { URL.revokeObjectURL(imagePreview.url); setImagePreview(null) }}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive flex items-center justify-center"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSendImage}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-sm font-semibold disabled:opacity-60"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send image
          </button>
          <button
            onClick={() => { URL.revokeObjectURL(imagePreview.url); setImagePreview(null) }}
            className="px-4 py-2 rounded-xl border border-border text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 border-t border-border bg-background">
      {replyTo && <ReplyPreview message={replyTo} onCancel={onCancelReply} />}
      <div className="flex items-end gap-2">
        {/* Image button */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-40"
          title="Send image"
        >
          <ImageIcon className="w-5 h-5" />
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />

        {/* Voice button */}
        <button
          onClick={() => setShowVoice(true)}
          disabled={disabled}
          className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-40"
          title="Record voice note"
        >
          <Mic className="w-5 h-5" />
        </button>

        {/* Text input */}
        <textarea
          value={text}
          onChange={e => handleTextChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message…"
          rows={1}
          disabled={disabled}
          className={cn(
            'flex-1 resize-none bg-muted rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
            'max-h-32 overflow-y-auto leading-relaxed disabled:opacity-60',
          )}
          style={{ height: 'auto' }}
          onInput={e => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 128) + 'px'
          }}
        />

        <button
          onClick={handleSendText}
          disabled={!text.trim() || disabled}
          className="p-2.5 rounded-xl gradient-primary disabled:opacity-40 transition-opacity shrink-0"
          title="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
