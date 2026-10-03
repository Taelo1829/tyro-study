"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Eye, EyeOff } from "lucide-react"

function getSafeCallbackUrl() {
  if (typeof window === "undefined") return "/dashboard"

  const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl")
  if (!callbackUrl) return "/dashboard"

  try {
    const url = new URL(callbackUrl, window.location.origin)
    if (url.origin !== window.location.origin) return "/dashboard"
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return "/dashboard"
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const callbackUrl = getSafeCallbackUrl()
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      })

      if (!result || result.error || !result.ok) {
        setError("Invalid email or password")
        setLoading(false)
        return
      }

      setRedirecting(true)
      // A full page load (not router.replace) so the dashboard is requested
      // fresh with the new session cookie. A soft navigation could reuse a
      // redirect to /login cached while signed out and leave this screen stuck.
      window.location.assign(callbackUrl)
    } catch {
      setError("Unable to sign in. Please try again.")
      setLoading(false)
    }
  }

  // If the page somehow hasn't changed after a few seconds, offer a way on
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!redirecting) return
    const timer = setTimeout(() => setSlow(true), 6000)
    return () => clearTimeout(timer)
  }, [redirecting])

  if (redirecting) {
    return (
      <>
        <h1 className="mb-1 text-2xl font-bold">Opening dashboard</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;re signed in. Taking you there now.
        </p>
        {slow && (
          <Button variant="primary" className="mt-6 w-full" onClick={() => window.location.assign(getSafeCallbackUrl())}>
            Continue to dashboard
          </Button>
        )}
      </>
    )
  }

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">Welcome back</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Sign in to continue studying
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="mt-2 text-right">
            <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Register
        </Link>
      </p>
    </>
  )
}
