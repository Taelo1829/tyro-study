import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { LOGIN_PER_EMAIL, LOGIN_PER_IP, clientIp, limitKey, retryAfter } from "@/lib/rate-limit"
import { log } from "@/lib/log"

const handler = NextAuth(authOptions)

type Ctx = { params: Promise<{ nextauth: string[] }> }

/**
 * Sign-in rate limit (TS-008): before NextAuth checks a password, refuse with
 * 429 if this email or network address has had too many wrong passwords
 * recently. Wrong passwords are counted in authorize() (src/lib/auth.ts).
 * The client's signIn() gets error "TooManyAttempts" and shows a message.
 */
async function POST(req: Request, ctx: Ctx) {
  const { nextauth } = await ctx.params
  if (nextauth?.join("/") === "callback/credentials") {
    const form = await req.clone().formData().catch(() => null)
    const email = String(form?.get("email") ?? "")
    const ip = clientIp(req.headers)
    const wait = Math.max(
      email ? await retryAfter(limitKey("login:email", email), LOGIN_PER_EMAIL) : 0,
      await retryAfter(limitKey("login:ip", ip), LOGIN_PER_IP)
    )
    if (wait > 0) {
      log.warn("auth.rate_limited", { waitSeconds: wait })
      const url = new URL("/api/auth/error?error=TooManyAttempts", req.url).toString()
      return NextResponse.json({ url }, { status: 429, headers: { "Retry-After": String(wait) } })
    }
  }
  return handler(req, ctx)
}

export { handler as GET, POST }
