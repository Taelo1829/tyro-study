"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

/** Marks an error group resolved; it reopens by itself if the error happens again. */
export function ResolveErrorButton({ fingerprint }: { fingerprint: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await fetch(`/api/admin/errors/${fingerprint}/resolve`, { method: "POST" }).catch(() => {})
        setBusy(false)
        router.refresh()
      }}
    >
      {busy ? "Saving…" : "Resolved"}
    </Button>
  )
}
