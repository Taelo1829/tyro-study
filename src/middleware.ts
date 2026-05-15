import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: {
    signIn: "/login",
  },
})

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
