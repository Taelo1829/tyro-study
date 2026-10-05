"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Brain } from "lucide-react"
import { cn } from "@/lib/utils"
import { MAIN_NAV, navLabel } from "@/lib/navigation"
import { useTerms } from "@/hooks/use-level"
import { useChatUnreadCount } from "@/hooks/use-chat-unread-count"
import { signOut } from "next-auth/react"
interface SidebarProps {
  isAdmin?: boolean
}

export function Sidebar({ isAdmin = false }: SidebarProps) {
  const pathname = usePathname()
  const unreadChats = useChatUnreadCount()
  const terms = useTerms()
  const items = MAIN_NAV.filter((item) => !item.adminOnly || isAdmin)

  return (
    <aside className="neo-flat sticky top-4 hidden h-[calc(100dvh-2rem)] w-64 shrink-0 flex-col rounded-[var(--neo-radius-xl)] p-4 lg:flex">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
          <Brain className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold tracking-tight">Tyro Study</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname?.startsWith(`${item.href}/`)
          const Icon = item.icon
          if (item.action == "logout") return <span
            key={item.href}
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition-all",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}>
            <span className="relative">
              <Icon className="h-4 w-4 shrink-0" />
              {item.badge && unreadChats > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange px-1 text-[10px] font-bold leading-none text-white">
                  {unreadChats > 99 ? "99+" : unreadChats}
                </span>
              )}
            </span>
            <span className="flex-1">{navLabel(item, terms)}</span>
          </span>
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span className="relative">
                <Icon className="h-4 w-4 shrink-0" />
                {item.badge && unreadChats > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange px-1 text-[10px] font-bold leading-none text-white">
                    {unreadChats > 99 ? "99+" : unreadChats}
                  </span>
                )}
              </span>
              <span className="flex-1">{navLabel(item, terms)}</span>
            </Link>
          )
        })}
      </nav>

    </aside>
  )
}
