"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { MAIN_NAV } from "@/lib/navigation"

interface MobileNavProps {
  isAdmin?: boolean
}

export function MobileNav({ isAdmin = false }: MobileNavProps) {
  const pathname = usePathname()
  const items = MAIN_NAV.filter((item) => !item.adminOnly || isAdmin).slice(
    0,
    5
  )

  return (
    <nav className="neo-glass fixed bottom-0 left-0 right-0 z-50 border-t border-foreground/5 px-2 pb-[env(safe-area-inset-bottom)] pt-2 lg:hidden">
      <ul className="flex items-center justify-around">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname?.startsWith(`${item.href}/`)
          const Icon = item.icon
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-[var(--neo-radius)] px-3 py-1.5 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "scale-110")} />
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
