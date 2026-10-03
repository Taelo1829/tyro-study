import Link from "next/link"
import { Brain } from "lucide-react"
import { AdSenseScript } from "@/components/ads/adsense-script"
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site"

/**
 * Header + footer for the public pages (home, study notes, about, privacy,
 * terms). `ads` loads AdSense - only pass it on pages with real content.
 */
export function PublicShell({ children, ads = false }: { children: React.ReactNode; ads?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white text-foreground">
      {ads && <AdSenseScript />}

      <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </span>
            <span className="hidden sm:inline">{SITE_NAME}</span>
          </Link>
          <nav aria-label="Main" className="ml-2 flex items-center gap-1 text-sm">
            <Link href="/notes" className="rounded-full px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
              Study notes
            </Link>
            <Link href="/about" className="hidden rounded-full px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-block">
              About
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <Link href="/login" className="rounded-full px-3 py-2 font-medium hover:bg-muted">
              Sign in
            </Link>
            <Link href="/register" className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/85">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md space-y-1">
            <p className="font-medium text-foreground">{SITE_NAME}</p>
            <p>
              An independent study app for UNISA students. Not affiliated with or endorsed by the University of South Africa.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/notes" className="hover:text-foreground">Study notes</Link>
            <Link href="/about" className="hover:text-foreground">About</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-foreground">Contact</a>
          </nav>
        </div>
        <p className="mx-auto max-w-5xl px-4 pb-8 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {SITE_NAME}
        </p>
      </footer>
    </div>
  )
}
