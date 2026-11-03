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
        // Admin pages: admins only (business/12 §3). Pages re-check the role in
        // the database (requireAdminPage) in case it changed since sign-in.
        if (pathname === "/admin" || pathname.startsWith("/admin/")) {
          return token?.role === "ADMIN"
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
    "/feedback/:path*",
    "/admin/:path*",
  ],
}