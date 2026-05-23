'use client'

import { useState, useRef } from 'react'
import { Play, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoiceNoteProps {
  url: string
  duration: number | null
  isMine: boolean
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function VoiceNote({ url, duration, isMine }: VoiceNoteProps) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function toggle() {
    if (!audioRef.current) {
      audioRef.current = new Audio(url)
      audioRef.current.onended = () => { setPlaying(false); setProgress(0); setCurrentTime(0) }
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime)
          setProgress(audioRef.current.currentTime / (audioRef.current.duration || 1))
        }
      }
    }
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }

  const displayDuration = duration ?? 0
  const displayTime = playing ? currentTime : displayDuration

  return (
    <div className={cn(
      'flex items-center gap-2.5 px-3 py-2.5 rounded-2xl min-w-[180px]',
      isMine ? 'bg-primary text-primary-foreground' : 'bg-muted',
    )}>
      <button
        onClick={toggle}
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors',
          isMine ? 'bg-white/20 hover:bg-white/30' : 'bg-primary/10 hover:bg-primary/20',
        )}
      >
        {playing
          ? <Pause className="w-3.5 h-3.5" />
          : <Play  className="w-3.5 h-3.5 ml-0.5" />
        }
      </button>

      <div className="flex-1 space-y-1 min-w-0">
        {/* Waveform-style bar */}
        <div className={cn(
          'h-1.5 rounded-full overflow-hidden',
          isMine ? 'bg-white/20' : 'bg-border',
        )}>
          <div
            className={cn(
              'h-full rounded-full transition-all',
              isMine ? 'bg-white' : 'bg-primary',
            )}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className={cn(
          'text-[10px] tabular-nums',
          isMine ? 'text-primary-foreground/70' : 'text-muted-foreground',
        )}>
          {formatDuration(displayTime)}
        </span>
      </div>
    </div>
  )
}
