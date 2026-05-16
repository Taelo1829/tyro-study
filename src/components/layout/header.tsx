"use client"

import { useSession } from "next-auth/react"
import { Bell } from "lucide-react"

interface HeaderProps {
  title?: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { data: session } = useSession()
  const name = session?.user?.name ?? "Student"

  return (
    <header className="neo-flat mb-6 flex items-center justify-between rounded-[var(--neo-radius-lg)] px-5 py-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="neo-button flex h-10 w-10 items-center justify-center rounded-full"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="neo-pressed flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-primary">
          {name.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  )
}
