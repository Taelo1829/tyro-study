import { withAuth } from "next-auth/middleware"

export default withAuth(
  function proxy() {
    // You can leave this empty or add logging if needed
  },
  {
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
    "/admin/:path*",
  ],
}