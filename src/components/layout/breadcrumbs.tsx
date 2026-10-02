import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Crumb {
  label: string
  /** Omit for the current page (the last crumb) */
  href?: string
}

/**
 * Small "Module / Chapter / Topic" trail. Long names are shortened so the
 * trail stays on one line on phones; the full name shows on hover.
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("mb-5 px-1", className)}>
      <ol className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground sm:text-sm">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${i}-${item.label}`} className={cn("flex min-w-0 items-center gap-1", last ? "shrink" : "shrink-[2]")}>
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />}
              {item.href && !last ? (
                <Link href={item.href} title={item.label} className="truncate transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} title={item.label} className={cn("truncate", last && "font-medium text-foreground")}>
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
