"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setMessage(data.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send the reset email.")
    } finally {
      setLoading(false)
    }
  }

  return <>
    <h1 className="mb-1 text-2xl font-bold">Reset your password</h1>
    <p className="mb-6 text-sm text-muted-foreground">Enter your email and we&apos;ll send you a reset link.</p>
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email</label>
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      {message && <p className="text-sm text-green-600" role="status">{message}</p>}
      {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>{loading ? "Sending..." : "Send reset link"}</Button>
    </form>
    <p className="mt-6 text-center text-sm text-muted-foreground"><Link href="/login" className="font-medium text-primary hover:underline">Back to sign in</Link></p>
  </>
}
