import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
// import { authOptions } from "@/lib/auth"
// import { prisma } from "@/lib/prisma"

export async function GET() {
    try {
        // const session = await getServerSession(authOptions)
        let session: any = {}
        if (!session || !session.user?.email) {
            return NextResponse.json(
                { error: "No active session" },
                { status: 200 }
            )
        }

        // Get additional user data from database
        // const user = await prisma.user.findUnique({
        //     where: { email: session.user.email },
        //     select: {
        //         id: true,
        //         name: true,
        //         email: true,
        //         streakDays: true,
        //         createdAt: true,
        //         updatedAt: true,
        //     }
        // })
        let user: any = {}

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            )
        }

        // Return combined session data
        return NextResponse.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                streakDays: user.streakDays,
                createdAt: user.createdAt,
            },
            expires: session.expires,
        })
    } catch (error) {
        console.error("Session API error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

export async function POST() {
    try {
        // const session = await getServerSession(authOptions)
        let session: any = {}
        if (!session || !session.user?.email) {
            return NextResponse.json(
                { error: "No active session" },
                { status: 200 }
            )
        }

        // Refresh session - just return current session
        return NextResponse.json({
            user: session.user,
            expires: session.expires,
            refreshed: true,
        })
    } catch (error) {
        console.error("Session refresh error:", error)
        return NextResponse.json(
            { error: "Failed to refresh session" },
            { status: 500 }
        )
    }
}

export async function DELETE() {
    try {
        // Session deletion is handled by NextAuth signOut
        // This endpoint can be used for additional cleanup

        return NextResponse.json({
            success: true,
            message: "Session cleared",
        })
    } catch (error) {
        console.error("Session deletion error:", error)
        return NextResponse.json(
            { error: "Failed to clear session" },
            { status: 500 }
        )
    }
}