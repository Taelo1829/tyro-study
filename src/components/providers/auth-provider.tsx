"use client"

import { SessionProvider } from "next-auth/react"
import { ReactNode, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

interface AuthProviderProps {
    children: ReactNode
}

// Session refresh interval (in seconds)
const SESSION_REFRESH_INTERVAL = 60 * 5 // 5 minutes

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
    "/",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/about",
    "/features",
    "/pricing",
    "/contact",
    "/terms",
    "/privacy",
]

export function AuthProvider({ children }: AuthProviderProps) {
    const pathname = usePathname()
    const router = useRouter()
    const [isSessionReady, setIsSessionReady] = useState(false)

    // Check if current route is public
    const isPublicRoute = PUBLIC_ROUTES.some(route =>
        pathname === route || pathname?.startsWith(route + "/")
    )

    // Handle session refresh and redirects
    useEffect(() => {
        // Only run on client side
        if (typeof window === "undefined") return

        // Set up session refresh interval
        const interval = setInterval(() => {
            // Trigger session refresh
            fetch("/api/auth/session")
                .then(res => res.json())
                .catch(err => console.error("Session refresh failed:", err))
        }, SESSION_REFRESH_INTERVAL * 1000)

        return () => clearInterval(interval)
    }, [])

    return (
        <SessionProvider
            refetchInterval={SESSION_REFRESH_INTERVAL}
            refetchOnWindowFocus={true}
            refetchWhenOffline={false}
        >
            {children}
        </SessionProvider>
    )
}