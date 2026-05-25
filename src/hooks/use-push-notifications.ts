"use client"

import { useState } from "react"

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

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "default"
  )
  const [loading, setLoading] = useState(false)

  async function enable() {
    if (!isPushSupported()) return false

    setLoading(true)
    try {
      const nextPermission = await Notification.requestPermission()
      setPermission(nextPermission)
      if (nextPermission !== "granted") return false

      const keyRes = await fetch("/api/push/public-key")
      if (!keyRes.ok) return false

      const { publicKey } = (await keyRes.json()) as { publicKey: string }
      const registration = await navigator.serviceWorker.register("/sw.js")
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
    } finally {
      setLoading(false)
    }
  }

  return {
    enable,
    loading,
    permission,
    enabled: permission === "granted",
    supported: isPushSupported(),
  }
}
