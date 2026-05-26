self.addEventListener("push", (event) => {
  const tag =
    self.crypto?.randomUUID?.() ??
    `chat-message-${Date.now()}-${Math.random().toString(36).slice(2)}`

  event.waitUntil(
    self.registration.showNotification("New chat message", {
      body: "Open Tyro Study to read your latest message.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag,
      data: { url: "/chat" },
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
