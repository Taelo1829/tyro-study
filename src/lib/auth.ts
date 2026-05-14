// lib/auth.ts

import { PrismaAdapter } from "@auth/prisma-adapter";
import type { DefaultSession, NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "./prisma";

declare module "next-auth" {
    interface Session extends DefaultSession {
        user: DefaultSession["user"] & {
            id: string;
        };
    }
}

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),

    session: {
        strategy: "jwt",
    },

    providers: [
        CredentialsProvider({
            name: "Credentials",

            credentials: {
                email: {
                    label: "Email",
                    type: "email",
                },
                password: {
                    label: "Password",
                    type: "password",
                },
            },

            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                // const user = await prisma.users.findUnique({
                //     where: {
                //         email: credentials.email,
                //     },
                // });

                // if (!user || !user.password) {
                //     return null;
                // }

                // const passwordMatch = await bcrypt.compare(
                //     credentials.password,
                //     user.password
                // );

                // if (!passwordMatch) {
                //     return null;
                // }

                return {
                    id: "",
                    email: "demo@email.com",
                    name: "demo",
                };
            },
        }),
    ],

    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }

            return token;
        },

        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
            }

            return session;
        },
    },

    pages: {
        signIn: "/login",
    },

    secret: process.env.AUTH_SECRET,
};