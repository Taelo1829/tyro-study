"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { PresenceChannel } from "pusher-js"
import { PRESENCE_CHANNEL, subscribeToPusherChannel, unsubscribeFromPusherChannel } from "@/lib/pusher"
import { cn } from "@/lib/utils"

/**
 * Who is online right now.
 *
 * - Live: every signed-in tab joins the Pusher presence channel, so people
 *   appear/disappear the moment they open or close the app.
 * - Last seen: a heartbeat stamps users.lastSeen every minute (and once more
 *   when the page is hidden/closed), which powers "Last seen 5 min ago" and is
 *   the fallback if the presence channel can't be joined.
 */

const HEARTBEAT_MS = 60_000
/** Without live presence, someone counts as online if they pinged this recently */
export const ONLINE_WINDOW_MS = 2.5 * 60_000

interface PresenceState {
  /** null until we know whether the live channel works */
  live: boolean | null
  online: Set<string>
  /** When we saw someone leave the live channel this session (ms) */
  leftAt: Map<string, number>
}

const PresenceContext = createContext<PresenceState>({ live: null, online: new Set(), leftAt: new Map() })

function sendHeartbeat(useBeacon = false) {
  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon("/api/presence")
      return
    }
    void fetch("/api/presence", { method: "POST", keepalive: true }).catch(() => {})
  } catch {
    // Presence is best-effort
  }
}

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const [live, setLive] = useState<boolean | null>(null)
  const [online, setOnline] = useState<Set<string>>(() => new Set())
  const [leftAt, setLeftAt] = useState<Map<string, number>>(() => new Map())

  // Heartbeat → users.lastSeen
  useEffect(() => {
    sendHeartbeat()
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") sendHeartbeat()
    }, HEARTBEAT_MS)
    const onVisibility = () => sendHeartbeat(document.visibilityState === "hidden")
    const onHide = () => sendHeartbeat(true)
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pagehide", onHide)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pagehide", onHide)
    }
  }, [])

  // Live presence channel
  useEffect(() => {
    let channel: PresenceChannel
    try {
      channel = subscribeToPusherChannel(PRESENCE_CHANNEL) as PresenceChannel
    } catch {
      // Pusher isn't configured - fall back to lastSeen (async to avoid a render cascade)
      const timer = setTimeout(() => setLive(false), 0)
      return () => clearTimeout(timer)
    }

    const onSubscribed = () => {
      const ids = new Set<string>()
      channel.members.each((member: { id: string }) => ids.add(member.id))
      setOnline(ids)
      setLive(true)
    }
    const onAdded = (member: { id: string }) => {
      setOnline(prev => new Set(prev).add(member.id))
    }
    const onRemoved = (member: { id: string }) => {
      setOnline(prev => {
        const next = new Set(prev)
        next.delete(member.id)
        return next
      })
      setLeftAt(prev => new Map(prev).set(member.id, Date.now()))
    }
    const onError = () => setLive(false)

    channel.bind("pusher:subscription_succeeded", onSubscribed)
    channel.bind("pusher:member_added", onAdded)
    channel.bind("pusher:member_removed", onRemoved)
    channel.bind("pusher:subscription_error", onError)
    // Already subscribed by another mount (e.g. fast refresh)
    if (channel.subscribed) onSubscribed()

    return () => {
      channel.unbind("pusher:subscription_succeeded", onSubscribed)
      channel.unbind("pusher:member_added", onAdded)
      channel.unbind("pusher:member_removed", onRemoved)
      channel.unbind("pusher:subscription_error", onError)
      unsubscribeFromPusherChannel(PRESENCE_CHANNEL)
    }
  }, [])

  const value = useMemo(() => ({ live, online, leftAt }), [live, online, leftAt])
  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
}

export interface UserPresence {
  online: boolean
  /** Best known time they were last active (null = never/unknown) */
  lastSeen: Date | null
}

/**
 * Presence for one user. `serverLastSeen` is the users.lastSeen value the page
 * already loaded; when live presence isn't available it's refreshed by polling.
 */
export function useUserPresence(
  userId: string | null | undefined,
  serverLastSeen?: string | null,
  { poll: shouldPoll = true }: { poll?: boolean } = {}
): UserPresence {
  const { live, online, leftAt } = useContext(PresenceContext)
  const [polled, setPolled] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // Tick so "last seen x min ago" and the fallback window stay current
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const poll = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/presence?ids=${encodeURIComponent(userId)}`)
      if (!res.ok) return
      const data: { lastSeen: Record<string, string | null> } = await res.json()
      setPolled(data.lastSeen[userId] ?? null)
    } catch {
      // ignore
    }
  }, [userId])

  // Only poll when the live channel isn't working
  useEffect(() => {
    if (live !== false || !userId || !shouldPoll) return
    const first = setTimeout(() => void poll(), 0)
    const timer = setInterval(() => void poll(), HEARTBEAT_MS)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [live, userId, poll, shouldPoll])

  if (!userId) return { online: false, lastSeen: null }

  const times = [serverLastSeen, polled]
    .filter((t): t is string => !!t)
    .map(t => new Date(t).getTime())
  const left = leftAt.get(userId)
  if (left) times.push(left)
  const last = times.length ? Math.max(...times) : null

  const isOnline = live ? online.has(userId) : last !== null && now - last < ONLINE_WINDOW_MS
  return { online: isOnline, lastSeen: last !== null ? new Date(last) : null }
}

/** "Online", "Last seen 5 min ago", "Last seen yesterday at 14:05", "Offline" */
export function describePresence({ online, lastSeen }: UserPresence, now = Date.now()): string {
  if (online) return "Online"
  if (!lastSeen) return "Offline"
  const diff = Math.max(0, now - lastSeen.getTime())
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "Last seen just now"
  if (min < 60) return `Last seen ${min} min ago`
  const time = lastSeen.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  const today = new Date(now)
  const yesterday = new Date(now - 86_400_000)
  if (lastSeen.toDateString() === today.toDateString()) return `Last seen today at ${time}`
  if (lastSeen.toDateString() === yesterday.toDateString()) return `Last seen yesterday at ${time}`
  return `Last seen ${lastSeen.toLocaleDateString([], { day: "numeric", month: "short" })}`
}

/**
 * Green dot for a profile picture. Place inside a `relative` wrapper around
 * the avatar. Uses live presence only (no polling), so it's cheap in lists.
 */
export function OnlineDot({
  userId,
  lastSeen,
  className,
}: {
  userId: string
  lastSeen?: string | null
  className?: string
}) {
  const { online } = useUserPresence(userId, lastSeen, { poll: false })
  if (!online) return null
  return (
    <span
      role="img"
      aria-label="Online"
      title="Online"
      className={cn("absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card", className)}
    />
  )
}
