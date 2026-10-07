"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { MAIN_NAV, navLabel } from "@/lib/navigation"
import { useTerms } from "@/hooks/use-level"
import { useChatUnreadCount } from "@/hooks/use-chat-unread-count"
import { signOut } from "next-auth/react"
import { askForNotificationsOnTap } from "@/hooks/use-push-notifications"

interface MobileNavProps {
  isAdmin?: boolean
}

export function MobileNav({ isAdmin = false }: MobileNavProps) {
  const pathname = usePathname()
  const unreadChats = useChatUnreadCount()
  const terms = useTerms()
  const items = MAIN_NAV.filter((item) => !item.adminOnly || isAdmin).slice(
    0,
    5
  )

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="neo-glass flex items-center justify-around rounded-full px-2 py-2 shadow-lg shadow-black/10">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname?.startsWith(`${item.href}/`)
          const Icon = item.icon
          if (item.action === "logout") {
            return (
              <li key={item.href}>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors"
                >
                  <Icon className="h-5 w-5" />
                  <span>{navLabel(item, terms)}</span>
                </button>
              </li>
            )
          }
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                // Opening Chats is a natural moment to offer message notifications
                onClick={item.href === "/chat" ? askForNotificationsOnTap : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[10px] font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {item.badge && unreadChats > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange px-1 text-[10px] font-bold leading-none text-white">
                      {unreadChats > 99 ? "99+" : unreadChats}
                    </span>
                  )}
                </span>
                <span>{navLabel(item, terms)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
