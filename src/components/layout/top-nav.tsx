"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { signOut, useSession } from "next-auth/react"
import { Bell, BellRing, Brain, ChevronDown, LogOut, Shield, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"
import { UserAvatar } from "@/components/ui/user-avatar"
import { MAIN_NAV } from "@/lib/navigation"
import { useChatUnreadCount } from "@/hooks/use-chat-unread-count"
import { usePushNotifications } from "@/hooks/use-push-notifications"

interface TopNavProps {
  isAdmin?: boolean
}

// Links shown in the bar; Profile, Admin and Logout live in the avatar menu
const BAR_HREFS = ["/dashboard", "/modules", "/timetable", "/chat"]

export function TopNav({ isAdmin = false }: TopNavProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const unreadChats = useChatUnreadCount()
  const push = usePushNotifications()
  const BellIcon = push.enabled ? BellRing : Bell

  const name = session?.user?.name ?? "Student"
  const email = session?.user?.email ?? ""
  const links = MAIN_NAV.filter(item => BAR_HREFS.includes(item.href))

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the avatar menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen])

  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`)

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-gradient-to-b from-background via-background/90 to-transparent px-3 pb-4 pt-3 sm:px-6">
      <nav
        aria-label="Main"
        className="neo-glass mx-auto flex h-16 max-w-7xl items-center gap-3 rounded-full px-3 shadow-lg shadow-black/5 ring-1 ring-border"
      >
        {/* Logo */}
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2 pl-1 pr-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </span>
          <span className="hidden text-lg font-semibold tracking-tight sm:inline">Tyro Study</span>
        </Link>

        {/* Page links (desktop) */}
        <ul className="mx-auto hidden items-center gap-1 rounded-full bg-muted p-1 lg:flex">
          {links.map(item => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-card hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {item.badge && unreadChats > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange px-1.5 text-[10px] font-bold leading-none text-white">
                      {unreadChats > 99 ? "99+" : unreadChats}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Right side */}
        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
          <button
            type="button"
            className="neo-button relative flex h-11 w-11 items-center justify-center"
            aria-label={push.enabled ? "Notifications enabled" : "Enable notifications"}
            title={push.enabled ? "Notifications enabled" : "Enable chat notifications"}
            disabled={!push.supported || push.loading}
            onClick={push.enable}
          >
            <BellIcon className="h-5 w-5 text-foreground" />
            {!push.enabled && (
              <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-orange" />
            )}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(open => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-1.5 rounded-full p-1 pr-2 transition-colors hover:bg-muted"
            >
              <UserAvatar name={name} image={session?.user?.image} />
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", menuOpen && "rotate-180")} />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+0.75rem)] w-60 overflow-hidden rounded-[var(--neo-radius)] bg-card p-2 shadow-xl shadow-black/10 ring-1 ring-border"
              >
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-semibold">{name}</p>
                  {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
                </div>
                <div className="my-1 h-px bg-border" />
                <Link
                  href="/profile"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-full px-3 py-2.5 text-sm hover:bg-muted"
                >
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  Profile
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-full px-3 py-2.5 text-sm hover:bg-muted"
                  >
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    Admin
                  </Link>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex w-full items-center gap-3 rounded-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  )
}
