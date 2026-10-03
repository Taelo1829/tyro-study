/**
 * One definition of the session cookie, shared by NextAuth (lib/auth.ts) and
 * the route guard (src/proxy.ts) so both always read the same cookie.
 *
 * NextAuth normally decides between "next-auth.session-token" and the
 * Secure "__Secure-next-auth.session-token" from NEXTAUTH_URL, and the route
 * guard guesses separately. With NEXTAUTH_URL set to the https production
 * address while running locally on http, the cookie became Secure — which
 * some browsers (e.g. Safari) and any non-localhost address refuse over http —
 * so sign-in "succeeded" but the guard saw no session and sent you back to
 * /login. Now: Secure cookies in production builds (the live https site),
 * ordinary cookies in local development, whatever NEXTAUTH_URL says.
 */

export const USE_SECURE_COOKIES = process.env.NODE_ENV === "production"

export const SESSION_COOKIE_NAME = `${USE_SECURE_COOKIES ? "__Secure-" : ""}next-auth.session-token`

export const AUTH_SECRET = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET
