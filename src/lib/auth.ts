import { PrismaAdapter } from "@auth/prisma-adapter"
import type { DefaultSession, NextAuthOptions } from "next-auth"
import type { Adapter } from "next-auth/adapters"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { AUTH_SECRET, SESSION_COOKIE_NAME, USE_SECURE_COOKIES } from "@/lib/auth-cookies"
import { getUserLevel } from "@/lib/levels-server"

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: DefaultSession["user"] & {
      id: string
      role?: string
      /** "tertiary" or "highschool" (decides modules vs subjects) */
      level?: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: string
    level?: string
  }
}


export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as unknown as Adapter,
  session: { strategy: "jwt" },
  // Same cookie the route guard (src/proxy.ts) reads - see lib/auth-cookies.ts
  useSecureCookies: USE_SECURE_COOKIES,
  cookies: {
    sessionToken: {
      name: SESSION_COOKIE_NAME,
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: USE_SECURE_COOKIES },
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Emails are matched case-insensitively so "Taelo@Mail.com" and
        // "taelo@mail.com" are the same account (registration and password reset
        // already normalise to lowercase).
        const email = credentials.email.trim().toLowerCase()
        const user =
          (await db.user.findUnique({ where: { email } })) ??
          (await db.user.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
          }))

        if (!user?.password) {
          return null
        }

        const valid = await bcrypt.compare(
          credentials.password,
          user.password
        )
        if (!valid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role
        token.level = await getUserLevel(user.id)
      }
      // The profile page calls useSession().update() after a change: reload
      // name, email and picture from the database (never from the client)
      if (trigger === "update" && token.id) {
        const fresh = await db.user.findUnique({
          where: { id: token.id },
          select: { name: true, email: true, image: true, role: true },
        })
        if (fresh) {
          token.name = fresh.name
          token.email = fresh.email
          token.picture = fresh.image
          token.role = fresh.role
          token.level = await getUserLevel(token.id)
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string | undefined
        session.user.level = token.level ?? "tertiary"
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: AUTH_SECRET,
}
