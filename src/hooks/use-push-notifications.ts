"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"

function urlBase64ToUint8Array(value: string) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)))
}

function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  )
}

/** iPhone/iPad only allow web notifications in the app installed to the home screen */
function readNeedsInstall() {
  if (typeof window === "undefined") return false
  const ua = navigator.userAgent
  const isIos = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return isIos && !installed
}

/**
 * Register the service worker, make sure this browser has a push
 * subscription, and save it on the server. Safe to call again: it reuses the
 * existing subscription.
 */
async function subscribeThisBrowser(): Promise<boolean> {
  const keyRes = await fetch("/api/push/public-key")
  if (!keyRes.ok) return false

  const { publicKey } = (await keyRes.json()) as { publicKey: string }
  const registration = await navigator.serviceWorker.register("/sw.js")
  await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }))

  const saveRes = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  })
  return saveRes.ok
}

async function showEnabledNotification(registration: ServiceWorkerRegistration) {
  await registration.showNotification("Tyro Study", {
    body: "Notifications are on. You'll hear about new messages and get reminders before your study sessions, due dates and exams.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: "notifications-enabled",
    data: { url: "/dashboard" },
  })
}

function readPermission(): NotificationPermission {
  return typeof window !== "undefined" && "Notification" in window
    ? Notification.permission
    : "default"
}

const noopSubscribe = () => () => {}

// Lets every component using the hook (the bell, the timetable banner) see
// the new permission as soon as it changes, wherever it was asked from
const PERMISSION_EVENT = "tyro:notification-permission"
const subscribePermission = (onChange: () => void) => {
  window.addEventListener(PERMISSION_EVENT, onChange)
  return () => window.removeEventListener(PERMISSION_EVENT, onChange)
}

/**
 * Ask for permission, subscribe this browser and save it. Must be called
 * straight from a tap or click: browsers only show the prompt then.
 * Notification.requestPermission() is the first thing it does, for that reason.
 */
async function turnOnNotifications(): Promise<boolean> {
  if (!isPushSupported()) return false
  try {
    const permission = await Notification.requestPermission()
    window.dispatchEvent(new Event(PERMISSION_EVENT))
    if (permission !== "granted") return false
    if (!(await subscribeThisBrowser())) return false
    await showEnabledNotification(await navigator.serviceWorker.ready)
    return true
  } catch (error) {
    console.error("Turning on notifications failed:", error)
    return false
  }
}

const ASKED_KEY = "tyro-notifications-asked-at"
const ASK_AGAIN_AFTER_MS = 3 * 24 * 60 * 60 * 1000

/**
 * Call from a tap (opening Chats, adding a timetable entry) to offer
 * notifications at a moment where they make sense. Does nothing when they're
 * already on, blocked, unsupported, or were offered in the last 3 days - so
 * someone who said "not now" isn't asked on every tap (Chrome also starts
 * muting sites that ask too often).
 */
export function askForNotificationsOnTap(): void {
  if (!isPushSupported() || Notification.permission !== "default") return
  try {
    const last = Number(window.localStorage.getItem(ASKED_KEY) ?? 0)
    if (Date.now() - last < ASK_AGAIN_AFTER_MS) return
    window.localStorage.setItem(ASKED_KEY, String(Date.now()))
  } catch {
    /* storage blocked: still ask */
  }
  void turnOnNotifications()
}

export function usePushNotifications() {
  // Reading Notification.permission during the first render made the server HTML
  // (always "default") differ from the browser's, causing a hydration mismatch
  // on every page with the header. useSyncExternalStore handles that safely.
  const browserPermission = useSyncExternalStore(
    subscribePermission,
    readPermission,
    () => "default" as NotificationPermission
  )
  const [requestedPermission, setPermission] = useState<NotificationPermission | null>(null)
  const permission = requestedPermission ?? browserPermission
  const supported = useSyncExternalStore(noopSubscribe, isPushSupported, () => false)
  const needsInstall = useSyncExternalStore(noopSubscribe, readNeedsInstall, () => false)
  const [loading, setLoading] = useState(false)

  // Already allowed on this device: quietly make sure the server has this
  // browser's subscription (it can be missing after clearing site data, or
  // when the browser renews it)
  const refreshed = useRef(false)
  useEffect(() => {
    if (refreshed.current || !supported || browserPermission !== "granted") return
    refreshed.current = true
    subscribeThisBrowser().catch(() => {})
  }, [supported, browserPermission])

  async function enable() {
    if (!isPushSupported()) return false

    setLoading(true)
    try {
      const ok = await turnOnNotifications()
      setPermission(readPermission())
      return ok
    } finally {
      setLoading(false)
    }
  }

  return {
    enable,
    loading,
    permission,
    enabled: permission === "granted",
    /** The user said no; only their browser settings can undo that */
    blocked: permission === "denied",
    supported,
    /** iPhone/iPad in Safari: install to the home screen first */
    needsInstall,
  }
}
