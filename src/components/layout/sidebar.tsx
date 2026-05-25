"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Brain, Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { MAIN_NAV } from "@/lib/navigation"
import { useThemeStore } from "@/store/theme-store"
import { Button } from "@/components/ui/button"
import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { EVENTS, getPusherClient, newMessageChannel, userChannel } from "@/lib/pusher"
import { ChatUser } from "../chat/types"

interface SidebarProps {
  isAdmin?: boolean
}

export function Sidebar({ isAdmin = false }: SidebarProps) {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { mode, toggle } = useThemeStore()
  const items = MAIN_NAV.filter((item) => !item.adminOnly || isAdmin)
  const currentUser = session?.user
  useEffect(() => {
    if (currentUser?.id) {
      const pusher = getPusherClient()
      const channel = pusher.subscribe(userChannel(currentUser.id))

      channel.bind(EVENTS.NEW_MESSAGE, (data: { friend: ChatUser; conversationId: string }) => {
        // Reload conversations to get the new one
        console.log("HERE")
        fetch('/api/chat/conversations')
          .then(r => r.json())
          .then(console.log)
      })
      return () => {
        // channel.unbind_all()
        // pusher.unsubscribe(userChannel(currentUser.id))
      }

    }
  }, [currentUser?.id])

  return (
    <aside className="neoNo active session-flat hidden h-full w-64 shrink-0 flex-col rounded-[var(--neo-radius-xl)] p-4 lg:flex">
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
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
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
