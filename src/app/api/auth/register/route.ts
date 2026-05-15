import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, password } = body as {
      name?: string
      email?: string
      password?: string
    }

    if (!email || !password || password.length < 8) {
      return NextResponse.json(
        { error: "Valid email and password (8+ chars) required" },
        { status: 400 }
      )
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      )
    }

    const hashed = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        name: name ?? null,
        email,
        password: hashed,
      },
      select: { id: true, email: true, name: true },
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    console.error("Register error:", error)

    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: string }).code)
        : ""

    if (code === "ECONNREFUSED" || code === "P1001") {
      return NextResponse.json(
        {
          error:
            "Cannot connect to the database. Start PostgreSQL (e.g. run `docker compose up -d`), set DIRECT_DATABASE_URL in .env, then run `npm run db:push`.",
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    )
  }
}
