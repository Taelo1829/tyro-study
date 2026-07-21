"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function ResetPasswordPage() {
  const token = useSearchParams().get("token") ?? ""
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (password !== confirmation) return setError("Passwords do not match.")
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setSuccess(data.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset your password.")
    } finally {
      setLoading(false)
    }
  }

  return <>
    <h1 className="mb-1 text-2xl font-bold">Choose a new password</h1>
    <p className="mb-6 text-sm text-muted-foreground">Your new password must be at least 8 characters.</p>
    {success ? <p className="text-sm text-green-600" role="status">{success} <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link></p> : <form onSubmit={handleSubmit} className="space-y-4">
      <div><label htmlFor="password" className="mb-1.5 block text-sm font-medium">New password</label><Input id="password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
      <div><label htmlFor="confirmation" className="mb-1.5 block text-sm font-medium">Confirm password</label><Input id="confirmation" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>
      {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading || !token}>{loading ? "Resetting..." : "Reset password"}</Button>
      {!token && <p className="text-sm text-red-500" role="alert">This reset link is incomplete.</p>}
    </form>}
  </>
}
