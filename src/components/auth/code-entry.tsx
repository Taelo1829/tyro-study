"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface ResendResult {
  error?: string
  /** Seconds until another code can be requested */
  resendIn?: number
}

/**
 * "We sent a code to …" box: one 6-digit field (works with phone
 * autofill from the email), a confirm button and a resend countdown.
 * `onVerify` returns an error message, or null when the code was accepted.
 */
export function CodeEntry({
  email,
  onVerify,
  onResend,
  onCancel,
  cancelLabel = "Use a different email",
  submitLabel = "Confirm",
  initialResendIn = 60,
  autoFocus = true,
  className,
}: {
  email: string
  onVerify: (code: string) => Promise<string | null>
  onResend: () => Promise<ResendResult>
  onCancel?: () => void
  cancelLabel?: string
  submitLabel?: string
  initialResendIn?: number
  autoFocus?: boolean
  className?: string
}) {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [busy, setBusy] = useState<"verify" | "resend" | null>(null)
  const [wait, setWait] = useState(initialResendIn)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) input.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait(w => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  const verify = async (value: string) => {
    if (value.length !== 6 || busy) return
    setError("")
    setInfo("")
    setBusy("verify")
    const problem = await onVerify(value).catch(() => "Something went wrong. Try again.")
    setBusy(null)
    if (problem) {
      setError(problem)
      setCode("")
      input.current?.focus()
    }
  }

  const resend = async () => {
    setError("")
    setInfo("")
    setBusy("resend")
    const result = await onResend().catch(() => ({ error: "Couldn't send a new code" }) as ResendResult)
    setBusy(null)
    if (result.resendIn) setWait(result.resendIn)
    if (result.error) setError(result.error)
    else {
      setInfo("New code sent. Check your inbox (and spam folder).")
      setCode("")
      input.current?.focus()
    }
  }

  return (
    <form
      className={cn("space-y-4", className)}
      onSubmit={e => {
        e.preventDefault()
        void verify(code)
      }}
    >
      <div className="flex gap-3">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm">
          We sent a 6-digit code to <span className="font-semibold break-all">{email}</span>. Enter it below to confirm this email
          works. It expires in 10 minutes.
        </p>
      </div>

      <div>
        <label htmlFor="otp-code" className="sr-only">
          6-digit code
        </label>
        <input
          ref={input}
          id="otp-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          placeholder="000000"
          aria-invalid={!!error}
          onChange={e => {
            const next = e.target.value.replace(/\D/g, "").slice(0, 6)
            setCode(next)
            if (next.length === 6) void verify(next)
          }}
          className="neo-inset h-14 w-full rounded-full border-0 text-center font-mono text-2xl tracking-[0.5em] text-foreground placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {info && !error && (
        <p role="status" className="text-sm text-green-700">
          {info}
        </p>
      )}

      <Button type="submit" variant="primary" className="w-full" disabled={code.length !== 6 || busy !== null}>
        {busy === "verify" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          type="button"
          onClick={resend}
          disabled={wait > 0 || busy !== null}
          className="font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
        >
          {busy === "resend" ? "Sending…" : wait > 0 ? `Resend code in ${wait}s` : "Resend code"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy !== null} className="text-muted-foreground hover:text-foreground">
            {cancelLabel}
          </button>
        )}
      </div>
    </form>
  )
}
