"use client"

import { useState } from "react"
import Link from "next/link"
import { Bug, Lightbulb, BookOpen, MessageSquare } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const KINDS = [
  { id: "bug", label: "Something isn't working", icon: Bug },
  { id: "content", label: "A mistake in a lesson or question", icon: BookOpen },
  { id: "idea", label: "An idea or request", icon: Lightbulb },
  { id: "other", label: "Something else", icon: MessageSquare },
] as const

const PROMPTS: Record<string, string> = {
  bug: "What were you doing, and what went wrong?",
  content: "Which lesson or question, and what's wrong with it?",
  idea: "What would make Tyro more useful for you?",
  other: "What would you like to tell us?",
}

/** Feedback form (business/12). Sends kind, message and the page the student came from; nothing else. */
export function FeedbackForm({ from, initialKind }: { from?: string; initialKind?: string }) {
  const [kind, setKind] = useState<string>(KINDS.some(k => k.id === initialKind) ? initialKind! : "bug")
  const [message, setMessage] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle")
  const [error, setError] = useState("")

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setState("sending")
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, message, page: from }),
    }).catch(() => null)
    if (res?.ok) {
      setState("sent")
      return
    }
    const data = (await res?.json().catch(() => null)) as { error?: string } | null
    setError(data?.error ?? "Couldn't send that. Check your connection and try again.")
    setState("idle")
  }

  if (state === "sent") {
    return (
      <>
        <Header title="Thank you" subtitle="We read every message." />
        <Card className="max-w-xl space-y-3">
          <p>Your feedback helps decide what we fix and build next. Changes show up in the app&apos;s release notes.</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild><Link href={from ?? "/dashboard"}>Back to studying</Link></Button>
            <Button variant="outline" onClick={() => { setMessage(""); setState("idle") }}>Send more</Button>
          </div>
        </Card>
      </>
    )
  }

  return (
    <>
      <Header title="Send feedback" subtitle="Tell us what's broken, what's wrong, or what you'd like." />
      <Card className="max-w-xl">
        <form onSubmit={send} className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">What is it about?</legend>
            <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
              {KINDS.map(k => (
                <label
                  key={k.id}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border-2 px-3 py-2 text-sm",
                    kind === k.id ? "border-foreground bg-muted/50" : "border-border hover:bg-muted/40"
                  )}
                >
                  <input type="radio" name="kind" value={k.id} checked={kind === k.id} onChange={() => setKind(k.id)} className="sr-only" />
                  <k.icon className="h-4 w-4 shrink-0" aria-hidden />
                  {k.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="feedback-message" className="mb-2 block text-sm font-medium">{PROMPTS[kind]}</label>
            <textarea
              id="feedback-message"
              required
              minLength={5}
              maxLength={2000}
              rows={6}
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full rounded-2xl border border-border bg-background p-3 text-base"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {from ? <>We&apos;ll include the page you came from ({from.split("?")[0]}). </> : null}
              Please don&apos;t include passwords or ID numbers.
            </p>
          </div>

          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

          <Button type="submit" disabled={state === "sending" || message.trim().length < 5} className="min-h-11">
            {state === "sending" ? "Sending…" : "Send feedback"}
          </Button>
        </form>
      </Card>
    </>
  )
}
