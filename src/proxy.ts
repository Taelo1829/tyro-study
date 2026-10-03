import { withAuth } from "next-auth/middleware"
import { AUTH_SECRET, SESSION_COOKIE_NAME } from "@/lib/auth-cookies"

export default withAuth(
  function proxy() {
    // You can leave this empty or add logging if needed
  },
  {
    // Read exactly the cookie NextAuth writes (lib/auth-cookies.ts)
    secret: AUTH_SECRET,
    cookies: { sessionToken: { name: SESSION_COOKIE_NAME } },
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        const publicPaths = [
          "/manifest.json",
          "/sw.js",
          "/favicon.ico",
          "/icons",
        ]

        if (publicPaths.some((path) => pathname.startsWith(path))) {
          return true
        }
        return !!token
      }
    },
  }
)

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/modules/:path*",
    "/timetable/:path*",
    "/flashcards/:path*",
    "/assignments/:path*",
    "/chat/:path*",
    "/settings/:path*",
    "/profile/:path*",
    "/admin/:path*",
  ],
}