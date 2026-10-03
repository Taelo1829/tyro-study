"use client"

import { useState } from "react"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CodeEntry } from "@/components/auth/code-entry"

async function readJson(res: Response) {
  return (await res.json().catch(() => ({}))) as { error?: string; resendIn?: number; email?: string }
}

export default function RegisterPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  // Set once the code has been emailed: step 2 (enter the code)
  const [pending, setPending] = useState<{ email: string; resendIn: number } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    })
    const data = await readJson(res)
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? "Registration failed")
      return
    }
    setPending({ email: data.email ?? email.trim().toLowerCase(), resendIn: data.resendIn ?? 60 })
  }

  async function verify(code: string): Promise<string | null> {
    if (!pending) return "Start again"
    const res = await fetch("/api/auth/register/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: pending.email, code }),
    })
    const data = await readJson(res)
    if (!res.ok) return data.error ?? "That code didn't work"

    const signInResult = await signIn("credentials", { email: pending.email, password, redirect: false })
    if (signInResult?.error) return "Your account is ready but signing in failed. Try logging in."
    // Full page load so the dashboard starts with the new session cookie
    window.location.assign("/dashboard")
    return null
  }

  async function resend() {
    if (!pending) return { error: "Start again" }
    const res = await fetch("/api/auth/register/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: pending.email }),
    })
    const data = await readJson(res)
    return { error: res.ok ? undefined : data.error ?? "Couldn't send a new code", resendIn: data.resendIn ?? (res.ok ? 60 : undefined) }
  }

  if (pending) {
    return (
      <>
        <h1 className="mb-1 text-2xl font-bold">Check your email</h1>
        <p className="mb-6 text-sm text-muted-foreground">One last step to create your account</p>
        <CodeEntry
          email={pending.email}
          initialResendIn={pending.resendIn}
          submitLabel="Confirm and create account"
          onVerify={verify}
          onResend={resend}
          onCancel={() => {
            setPending(null)
            setError("")
          }}
        />
      </>
    )
  }

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">Create account</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Start your structured study journey
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
            Name
          </label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium"
          >
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            At least 8 characters
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  )
}
