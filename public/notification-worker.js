// Only one focused tab plays the chime. If audio is blocked or no tab is open,
// leave sound to the device instead of silently dropping it.
async function playForegroundSound() {
  try {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    const client = clients.find(client => client.focused && client.visibilityState === "visible")
    if (!client) return false
    return await new Promise(resolve => {
      const channel = new MessageChannel()
      const finish = played => {
        clearTimeout(timer)
        channel.port1.close()
        resolve(played)
      }
      const timer = setTimeout(() => finish(false), 500)
      channel.port1.onmessage = event => finish(event.data?.played === true)
      client.postMessage({ type: "tyro:notification-sound" }, [channel.port2])
    })
  } catch { return false }
}

self.addEventListener("push", (event) => {
  // Messages with text (calendar reminders) carry their own title, body and
  // link; an empty push is a chat ping, as before.
  let message = null
  try {
    message = event.data ? event.data.json() : null
  } catch {
    message = null
  }

  const tag =
    message?.tag ??
    self.crypto?.randomUUID?.() ??
    `chat-message-${Date.now()}-${Math.random().toString(36).slice(2)}`

  event.waitUntil(
    playForegroundSound().then(played => self.registration.showNotification(message?.title ?? "New chat message", {
      body: message?.body ?? "Open Tyro Study to read your latest message.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag,
      data: { url: message?.url ?? "/chat" },
      renotify: true,
      silent: played,
      ...(played ? {} : { vibrate: [150, 80, 150] }),
    }))
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const targetUrl = new URL(event.notification.data?.url ?? "/chat", self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin))
      if (existing) {
        existing.focus()
        return existing.navigate(targetUrl)
      }

      return self.clients.openWindow(targetUrl)
    })
  )
})
