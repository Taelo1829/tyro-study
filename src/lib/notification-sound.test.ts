import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { expect, it, vi } from "vitest"

const worker = readFileSync("public/notification-worker.js", "utf8")

it("loads the push handler in development and production workers", () => {
  expect(readFileSync("public/sw.js", "utf8")).toContain('importScripts("/notification-worker.js")')
  expect(readFileSync("next.config.ts", "utf8")).toContain('importScripts: ["/notification-worker.js"]')
})

async function push({ focused = false, played = false, responds = true } = {}) {
  const handlers: Record<string, (event: unknown) => void> = {}
  const showNotification = vi.fn().mockResolvedValue(undefined)
  const postMessage = vi.fn((_data, ports) => {
    if (responds) ports[0].reply({ data: { played } })
  })
  class Channel {
    port1 = { onmessage: vi.fn<(event: unknown) => void>(), close: vi.fn() }
    port2 = { reply: (event: unknown) => this.port1.onmessage(event) }
  }
  runInNewContext(worker, {
    self: {
      addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler },
      clients: { matchAll: async () => focused ? [{ focused: true, visibilityState: "visible", postMessage }] : [] },
      registration: { showNotification },
    },
    MessageChannel: Channel, setTimeout, clearTimeout,
  })
  let done: Promise<unknown> = Promise.resolve()
  handlers.push({ data: { json: () => ({ title: "Lesson ready", body: "Review your lesson", tag: "job-1" }) }, waitUntil: (promise: Promise<unknown>) => { done = promise } })
  await done
  return { showNotification, postMessage }
}

it("requests system sound and vibration without an open focused tab", async () => {
  const { showNotification } = await push()
  expect(showNotification).toHaveBeenCalledWith("Lesson ready", expect.objectContaining({ silent: false, vibrate: [150, 80, 150] }))
})

it("avoids duplicate system sound when the foreground chime played", async () => {
  const { showNotification, postMessage } = await push({ focused: true, played: true })
  expect(postMessage).toHaveBeenCalledTimes(1)
  expect(showNotification.mock.calls[0][1].silent).toBe(true)
  expect(showNotification.mock.calls[0][1]).not.toHaveProperty("vibrate")
})

it("falls back to system sound when browser audio is blocked", async () => {
  const { showNotification } = await push({ focused: true })
  expect(showNotification.mock.calls[0][1].silent).toBe(false)
})

it("still displays an audible notification if an older tab does not respond", async () => {
  const { showNotification } = await push({ focused: true, responds: false })
  expect(showNotification.mock.calls[0][1].silent).toBe(false)
})
