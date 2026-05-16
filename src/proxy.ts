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
      authorized: ({ token }) => !!token, // only allow logged-in users
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
    "/settings/:path*",
    "/admin/:path*",
  ],
}