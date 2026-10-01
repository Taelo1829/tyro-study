"use client"

import { useSession } from "next-auth/react"

interface HeaderProps {
  title?: string
  subtitle?: string
}

// Page heading. The bell, avatar and navigation now live in the fixed TopNav.
export function Header({ title, subtitle }: HeaderProps) {
  const { data: session } = useSession()
  const firstName = (session?.user?.name ?? "Student").split(" ")[0]

  return (
    <header className="mb-6 px-1">
      <p className="mb-1 text-sm font-medium text-muted-foreground">Hi, {firstName} 👋</p>
      {title && (
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
      )}
      {subtitle && (
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      )}
    </header>
  )
}
