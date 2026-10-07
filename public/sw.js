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
    self.registration.showNotification(message?.title ?? "New chat message", {
      body: message?.body ?? "Open Tyro Study to read your latest message.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag,
      data: { url: message?.url ?? "/chat" },
      renotify: true,
    })
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
