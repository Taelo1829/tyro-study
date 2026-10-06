"use client"

import { useEffect, useState } from "react"
import { Download, Share, SquarePlus } from "lucide-react"
import { Modal, ModalBody, ModalFooter } from "@/components/admin/modal"
import { Button } from "@/components/ui/button"

/**
 * Asks the student to install Tyro Study as an app, every visit, until they do.
 *
 * - Chrome / Edge / Android: uses the browser's own install prompt
 *   (beforeinstallprompt), so "Install" installs it in one tap.
 * - iPhone / iPad and Safari on Mac: there is no install prompt, so we show
 *   the steps (Share → Add to Home Screen / File → Add to Dock).
 * - Already running as the installed app, or installed from this browser:
 *   never shown.
 * - "Later" hides it for the rest of this visit; it comes back next time.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

type Mode = "prompt" | "ios" | "mac-safari"

const INSTALLED_KEY = "tyro-pwa-installed"
const LATER_KEY = "tyro-pwa-later"
const SHOW_DELAY_MS = 2500

// Storage can be blocked (private mode, strict settings), so never let it throw
function read(storage: () => Storage, key: string) {
  try {
    return storage().getItem(key)
  } catch {
    return null
  }
}
function write(storage: () => Storage, key: string, value: string) {
  try {
    storage().setItem(key, value)
  } catch {
    /* ignore */
  }
}
const local = () => window.localStorage
const session = () => window.sessionStorage

function isRunningInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function detectManualMode(): Mode | null {
  const ua = navigator.userAgent
  // iPadOS reports itself as a Mac, so also check for touch
  const isIos = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  if (isIos) return "ios"
  const isSafari = /safari/i.test(ua) && !/chrome|chromium|crios|edg|firefox|fxios|opr/i.test(ua)
  if (/macintosh/i.test(ua) && isSafari) return "mac-safari"
  return null
}

export function InstallPrompt() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode | null>(null)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (isRunningInstalled() || read(local, INSTALLED_KEY)) return
    if (read(session, LATER_KEY)) return

    let timer: ReturnType<typeof setTimeout> | undefined
    const showSoon = (next: Mode) => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        setMode(next)
        setOpen(true)
      }, SHOW_DELAY_MS)
    }

    const onBeforeInstall = (event: Event) => {
      // Keep the browser's mini-bar away; we show our own pop-up instead
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
      showSoon("prompt")
    }
    const onInstalled = () => {
      write(local, INSTALLED_KEY, "1")
      setOpen(false)
      setDeferred(null)
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    window.addEventListener("appinstalled", onInstalled)

    // Browsers without an install prompt get the manual steps instead
    const manual = detectManualMode()
    if (manual) showSoon(manual)

    return () => {
      clearTimeout(timer)
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const later = () => {
    write(session, LATER_KEY, "1")
    setOpen(false)
  }

  const install = async () => {
    if (!deferred) return
    setInstalling(true)
    try {
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      if (outcome === "accepted") {
        write(local, INSTALLED_KEY, "1")
        setOpen(false)
      } else {
        // They said no in the browser's dialog: treat it like "Later"
        later()
      }
    } finally {
      // A saved prompt can only be used once
      setDeferred(null)
      setInstalling(false)
    }
  }

  if (!mode) return null

  return (
    <Modal open={open} onClose={later} size="sm">
      <ModalBody className="pt-7 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={64} height={64} className="mx-auto mb-4 h-16 w-16 rounded-2xl shadow-sm" />
        <h2 className="text-lg font-semibold">Install Tyro Study</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Open it straight from your home screen, full screen, like any other app. It&apos;s quicker and works better on your phone.
        </p>

        {mode === "ios" && (
          <ol className="mt-5 space-y-3 text-left text-sm">
            <li className="flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-3">
              <Share className="h-5 w-5 shrink-0" />
              <span>
                Tap the <span className="font-semibold">Share</span> button in Safari&apos;s toolbar
              </span>
            </li>
            <li className="flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-3">
              <SquarePlus className="h-5 w-5 shrink-0" />
              <span>
                Choose <span className="font-semibold">Add to Home Screen</span>, then tap <span className="font-semibold">Add</span>
              </span>
            </li>
          </ol>
        )}

        {mode === "mac-safari" && (
          <ol className="mt-5 space-y-3 text-left text-sm">
            <li className="flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-3">
              <Share className="h-5 w-5 shrink-0" />
              <span>
                In Safari&apos;s menu bar, choose <span className="font-semibold">File → Add to Dock</span>
              </span>
            </li>
          </ol>
        )}
      </ModalBody>

      <ModalFooter align="center" className="border-t-0 pb-6 pt-1">
        <Button variant="outline" onClick={later} className="flex-1">
          Later
        </Button>
        {mode === "prompt" ? (
          <Button variant="primary" onClick={install} disabled={installing || !deferred} className="flex-1">
            <Download className="h-4 w-4" />
            {installing ? "Installing..." : "Install"}
          </Button>
        ) : (
          <Button variant="primary" onClick={later} className="flex-1">
            Got it
          </Button>
        )}
      </ModalFooter>
    </Modal>
  )
}
