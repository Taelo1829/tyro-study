'use client'

import { useState, useRef, useCallback } from 'react'
import { Send, Image as ImageIcon, Mic, X, Loader2 } from 'lucide-react'
import { VoiceRecorder } from './voice-recorder'
import { cn } from '@/lib/utils'

interface MessageInputProps {
  conversationId: string
  onSend: (payload: {
    type: 'TEXT' | 'IMAGE' | 'VOICE'
    content?: string
    mediaUrl?: string
    mediaDuration?: number
  }) => void
  onTyping: (isTyping: boolean) => void
  disabled?: boolean
}

export function MessageInput({ conversationId, onSend, onTyping, disabled }: MessageInputProps) {
  const [text, setText] = useState('')
  const [showVoice, setShowVoice] = useState(false)
  const [imagePreview, setImagePreview] = useState<{ url: string; file: File } | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Typing indicator ───────────────────────────────────────────────────────
  function handleTextChange(val: string) {
    setText(val)
    onTyping(true)
    typingTimer.current && clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => onTyping(false), 2000)
  }

  // ── Send text ──────────────────────────────────────────────────────────────
  function handleSendText() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend({ type: 'TEXT', content: trimmed })
    setText('')
    onTyping(false)
    typingTimer.current && clearTimeout(typingTimer.current)
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

      onSend({ type: 'IMAGE', mediaUrl: url })
      URL.revokeObjectURL(imagePreview.url)
      setImagePreview(null)
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

      onSend({ type: 'VOICE', mediaUrl: url, mediaDuration: duration })
      setShowVoice(false)
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
        <div className="relative w-32">
          <img
            src={imagePreview.url}
            alt="Preview"
            className="w-32 h-32 object-cover rounded-xl border border-border"
          />
          <button
            onClick={() => { URL.revokeObjectURL(imagePreview.url); setImagePreview(null) }}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSendImage}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-white text-sm font-semibold disabled:opacity-60"
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

        {/* Send */}
        <button
          onClick={handleSendText}
          disabled={!text.trim() || disabled}
          className="p-2.5 rounded-xl gradient-primary text-white disabled:opacity-40 transition-opacity shrink-0"
          title="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
