'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, Square, Send, Trash2, Play, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoiceRecorderProps {
  onSend: (blob: Blob, duration: number) => void
  onCancel: () => void
  disabled?: boolean
}

const MAX_SECONDS = 120

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function VoiceRecorder({ onSend, onCancel, disabled }: VoiceRecorderProps) {
  const [phase, setPhase] = useState<'recording' | 'preview'>('recording')
  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [playProgress, setPlayProgress] = useState(0)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef<number>(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const unmountedRef = useRef(false)

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function releaseMicrophone() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  function stopRecording() {
    clearTimer()
    // Work out the length from the start time rather than from React state -
    // the auto-stop at 2 minutes ran inside an interval whose closure only
    // ever saw `elapsed === 0`, so long notes were saved as 1 second.
    const seconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
    setDuration(Math.min(seconds, MAX_SECONDS))
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop()
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (unmountedRef.current) {
        // Cancelled while the permission prompt was open
        stream.getTracks().forEach(t => t.stop())
        return
      }
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }

      recorder.onstop = () => {
        releaseMicrophone()
        if (unmountedRef.current) return
        const recorded = new Blob(chunksRef.current, { type: mimeType })
        setBlob(recorded)
        audioUrlRef.current = URL.createObjectURL(recorded)
        audioRef.current = new Audio(audioUrlRef.current)
        audioRef.current.onended = () => { setPlaying(false); setPlayProgress(0) }
        audioRef.current.ontimeupdate = () => {
          if (audioRef.current) {
            setPlayProgress(audioRef.current.currentTime / (audioRef.current.duration || 1))
          }
        }
        setPhase('preview')
      }

      recorder.start(100)
      startedAtRef.current = Date.now()

      timerRef.current = setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000)
        setElapsed(seconds)
        if (seconds >= MAX_SECONDS) stopRecording()
      }, 250)
    } catch {
      if (!unmountedRef.current) setError('Microphone access denied')
    }
  }

  // Start recording immediately on mount
  useEffect(() => {
    unmountedRef.current = false
    startRecording()
    return () => {
      // Runs when the recorder is cancelled/closed. Previously the microphone
      // stream was never stopped here, so the mic stayed on after cancelling.
      unmountedRef.current = true
      clearTimer()
      if (mediaRef.current && mediaRef.current.state !== 'inactive') {
        mediaRef.current.stop()
      }
      releaseMicrophone()
      audioRef.current?.pause()
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function togglePlay() {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }

  function handleSend() {
    if (!blob) return
    onSend(blob, duration || elapsed)
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-destructive/10 rounded-xl text-destructive text-sm">
        {error}
        <button onClick={onCancel} className="ml-auto text-xs underline">Dismiss</button>
      </div>
    )
  }

  // ── Recording phase ────────────────────────────────────────────────────────
  if (phase === 'recording') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl">
        {/* Pulse dot */}
        <div className="relative shrink-0">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-60" />
        </div>

        {/* Waveform bars (decorative) */}
        <div className="flex items-center gap-0.5 flex-1">
          {Array.from({ length: 28 }).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-primary/40 rounded-full animate-pulse"
              style={{
                height: `${8 + Math.sin(i * 0.8 + Date.now() / 500) * 6 + Math.random() * 4}px`,
                animationDelay: `${i * 50}ms`,
              }}
            />
          ))}
        </div>

        <span className="text-sm font-mono font-semibold text-red-500 shrink-0 tabular-nums">
          {formatDuration(elapsed)}
        </span>

        <button
          onClick={stopRecording}
          className="p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors shrink-0"
          title="Stop recording"
        >
          <Square className="w-4 h-4 fill-current" />
        </button>

        <button
          onClick={onCancel}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0"
          title="Cancel"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    )
  }

  // ── Preview phase ──────────────────────────────────────────────────────────
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-card border border-primary/30 rounded-xl">
      <button
        onClick={togglePlay}
        className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center shrink-0"
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      <div className="flex-1 space-y-1">
        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full gradient-primary rounded-full transition-all"
            style={{ width: `${playProgress * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(duration)}</span>
      </div>

      <button
        onClick={onCancel}
        className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
        title="Discard"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <button
        onClick={handleSend}
        disabled={disabled}
        className="p-2 rounded-lg gradient-primary  disabled:opacity-60 shrink-0"
        title="Send voice note"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  )
}
