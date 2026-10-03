import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

/**
 * This file sits at the same URL as NextAuth's own session endpoint
 * (/api/auth/session) and, because a specific route beats the
 * [...nextauth] catch-all, it decides what that URL returns.
 *
 * It used to return { error: "No active session" } for signed-out visitors.
 * NextAuth's browser code treats any non-empty reply as a signed-in session,
 * so signed-out users were seen as "authenticated" - the home page then
 * bounced them to /dashboard → /login, and that cached redirect left the
 * login screen stuck on "Taking you there now".
 *
 * Now it simply hands the request to NextAuth as if it had come through
 * /api/auth/[...nextauth], so the reply is exactly NextAuth's: the session,
 * or {} when signed out (and the session cookie is refreshed as normal).
 */

const nextAuthHandler = NextAuth(authOptions) as (
  req: Request,
  context: { params: Promise<{ nextauth: string[] }> }
) => Promise<Response>

const sessionContext = () => ({ params: Promise.resolve({ nextauth: ["session"] }) })

export function GET(req: Request) {
  return nextAuthHandler(req, sessionContext())
}

/** useSession().update() posts here */
export function POST(req: Request) {
  return nextAuthHandler(req, sessionContext())
}
