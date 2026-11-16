"use client"

import { useEffect } from "react"

/** Unlock audio on interaction; never replay notifications received before it. */
export function NotificationSound() {
  useEffect(() => {
    let audio: AudioContext | null = null
    let lastPing = 0
    const unlock = () => {
      try {
        audio ??= new AudioContext()
        if (audio.state === "suspended") void audio.resume().catch(() => {})
      } catch { /* The system notification remains the fallback. */ }
    }
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "tyro:notification-sound") return
      let played = false
      if (document.visibilityState === "visible" && document.hasFocus() && audio?.state === "running") {
        try {
          // One chime for a burst of notifications, rather than overlapping tones.
          if (Date.now() - lastPing >= 1000) {
            const oscillator = audio.createOscillator()
            const gain = audio.createGain()
            const now = audio.currentTime
            oscillator.type = "sine"
            oscillator.frequency.setValueAtTime(880, now)
            oscillator.frequency.setValueAtTime(1174.66, now + 0.12)
            gain.gain.setValueAtTime(0, now)
            gain.gain.linearRampToValueAtTime(0.12, now + 0.015)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
            oscillator.connect(gain)
            gain.connect(audio.destination)
            oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
            oscillator.start(now)
            oscillator.stop(now + 0.42)
            lastPing = Date.now()
          }
          played = true
        } catch { /* Ask the device to play its normal notification sound. */ }
      }
      event.ports[0]?.postMessage({ played })
    }
    window.addEventListener("pointerdown", unlock)
    window.addEventListener("keydown", unlock)
    navigator.serviceWorker?.addEventListener("message", onMessage)
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
      navigator.serviceWorker?.removeEventListener("message", onMessage)
      if (audio) void audio.close().catch(() => {})
    }
  }, [])
  return null
}
