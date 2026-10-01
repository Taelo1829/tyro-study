import Link from "next/link"
import { Brain } from "lucide-react"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
      <Link
        href="/"
        className="mb-8 flex items-center gap-2 text-lg font-bold"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary">
          <Brain className="h-5 w-5 text-primary-foreground" />
        </div>
        Tyro Study
      </Link>
      <div className="neo-flat w-full max-w-md rounded-[var(--neo-radius-xl)] p-8">
        {children}
      </div>
    </div>
  )
}
