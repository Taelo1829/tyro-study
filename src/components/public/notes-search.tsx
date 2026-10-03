"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Search, X } from "lucide-react"

/**
 * Search box for the public notes. Updates ?q= as you type (after a short
 * pause) so results render on the server; also works as a plain form
 * without JavaScript.
 */
export function NotesSearch({ initial = "" }: { initial?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(initial)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const timer = setTimeout(() => {
      const q = value.trim()
      router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false })
    }, 300)
    return () => clearTimeout(timer)
  }, [value, pathname, router])

  return (
    <form role="search" action={pathname} onSubmit={e => e.preventDefault()} className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        type="search"
        name="q"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Search topics, e.g. eigenvalues, recursion, matrices"
        aria-label="Search study notes"
        className="h-12 w-full rounded-full border border-foreground bg-white pl-11 pr-11 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  )
}
