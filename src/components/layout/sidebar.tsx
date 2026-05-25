"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Brain, Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { MAIN_NAV } from "@/lib/navigation"
import { useThemeStore } from "@/store/theme-store"
import { Button } from "@/components/ui/button"
import { useChatUnreadCount } from "@/hooks/use-chat-unread-count"

interface SidebarProps {
  isAdmin?: boolean
}

export function Sidebar({ isAdmin = false }: SidebarProps) {
  const pathname = usePathname()
  const { mode, toggle } = useThemeStore()
  const unreadChats = useChatUnreadCount()
  const items = MAIN_NAV.filter((item) => !item.adminOnly || isAdmin)

  return (
    <aside className="neo-flat hidden h-full w-64 shrink-0 flex-col rounded-[var(--neo-radius-xl)] p-4 lg:flex">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="neo-pressed flex h-10 w-10 items-center justify-center rounded-full">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <span className="text-lg font-bold tracking-tight">Tyro Study</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname?.startsWith(`${item.href}/`)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-[var(--neo-radius)] px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "neo-pressed text-primary"
                  : "text-muted-foreground hover:neo-flat hover:text-foreground"
              )}
            >
              <span className="relative">
                <Icon className="h-4 w-4 shrink-0" />
                {item.badge && unreadChats > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                    {unreadChats > 99 ? "99+" : unreadChats}
                  </span>
                )}
              </span>
              <span className="flex-1">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-4 border-t border-foreground/5 pt-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={toggle}
          aria-label="Toggle theme"
        >
          {mode === "light" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
          {mode === "light" ? "Dark mode" : "Light mode"}
        </Button>
      </div>
    </aside>
  )
}
