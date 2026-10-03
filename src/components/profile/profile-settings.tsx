"use client"

import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { Camera, Check, Eye, EyeOff, KeyRound, Loader2, Trash2, UserRound } from "lucide-react"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserAvatar } from "@/components/ui/user-avatar"
import { CodeEntry } from "@/components/auth/code-entry"
import { cn } from "@/lib/utils"

interface Profile {
  id: string
  name: string | null
  email: string
  image: string | null
  role: string
  createdAt: string
  hasPassword: boolean
  /** New email waiting for its 6-digit code */
  pendingEmail: string | null
}

type Status = { type: "success" | "error"; text: string } | null

const AVATAR_SIZE = 384

/** Crop the middle square of a photo and shrink it, so uploads are small and avatars look sharp */
async function squareAvatar(file: File): Promise<File> {
  if (file.type === "image/gif") return file // keep animation
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const size = Math.min(AVATAR_SIZE, side)
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return file
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  bitmap.close()
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", 0.9))
  if (!blob || blob.type !== "image/webp") {
    const jpeg = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9))
    return jpeg ? new File([jpeg], "avatar.jpg", { type: "image/jpeg" }) : file
  }
  return new File([blob], "avatar.webp", { type: "image/webp" })
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

export function ProfileSettings() {
  const { update } = useSession()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    fetch("/api/profile")
      .then(async res => (res.ok ? setProfile(await res.json()) : setLoadError(await readError(res, "Couldn't load your profile"))))
      .catch(() => setLoadError("Couldn't load your profile"))
  }, [])

  // Refresh the session so the top bar, chat and so on show the change
  const saved = async (next: Profile) => {
    setProfile(next)
    await update()
  }

  if (!profile) {
    return <p className="px-1 text-sm text-muted-foreground">{loadError || "Loading…"}</p>
  }

  const joined = new Date(profile.createdAt).toLocaleDateString("en-ZA", { month: "long", year: "numeric" })

  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumbs items={[{ label: "Profile" }]} />

      <div className="mb-8 flex items-center gap-4 px-1">
        <UserAvatar name={profile.name ?? profile.email} image={profile.image} className="h-16 w-16 text-2xl" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{profile.name || "Add your name"}</h1>
          <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {profile.role === "ADMIN" ? "Admin · " : ""}Member since {joined}
          </p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 border border-foreground shadow-none">
          <TabsTrigger value="profile" className="gap-2">
            <UserRound className="h-4 w-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="password" className="gap-2">
            <KeyRound className="h-4 w-4" /> Password
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-10 px-1">
          <PhotoSection profile={profile} onSaved={saved} />
          <DetailsSection profile={profile} onSaved={saved} />
        </TabsContent>

        <TabsContent value="password" className="px-1">
          <PasswordSection hasPassword={profile.hasPassword} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}

function StatusLine({ status }: { status: Status }) {
  if (!status) return null
  return (
    <p role={status.type === "error" ? "alert" : "status"} className={cn("text-sm", status.type === "error" ? "text-red-600" : "text-green-700")}>
      {status.type === "success" && <Check className="mr-1 inline h-4 w-4 align-[-3px]" />}
      {status.text}
    </p>
  )
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function PhotoSection({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null)
  const [status, setStatus] = useState<Status>(null)

  const upload = async (file: File | undefined) => {
    if (!file) return
    setStatus(null)
    if (!file.type.startsWith("image/")) {
      setStatus({ type: "error", text: "Choose an image file" })
      return
    }
    setBusy("upload")
    try {
      const form = new FormData()
      form.append("file", await squareAvatar(file))
      const res = await fetch("/api/profile/avatar", { method: "POST", body: form })
      if (!res.ok) throw new Error(await readError(res, "Couldn't upload that picture"))
      await onSaved(await res.json())
      setStatus({ type: "success", text: "Profile picture updated" })
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Couldn't upload that picture" })
    } finally {
      setBusy(null)
      if (input.current) input.current.value = ""
    }
  }

  const remove = async () => {
    setStatus(null)
    setBusy("remove")
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" })
      if (!res.ok) throw new Error(await readError(res, "Couldn't remove your picture"))
      await onSaved(await res.json())
      setStatus({ type: "success", text: "Profile picture removed" })
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Couldn't remove your picture" })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section>
      <SectionTitle title="Profile picture" description="Shown in chats and next to your name. Square photos work best." />
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy !== null}
          className="group relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label="Change profile picture"
        >
          <UserAvatar name={profile.name ?? profile.email} image={profile.image} className="h-24 w-24 text-3xl" />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {busy === "upload" ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
          </span>
        </button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => input.current?.click()} disabled={busy !== null}>
            {busy === "upload" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
            {profile.image ? "Change picture" : "Upload picture"}
          </Button>
          {profile.image && (
            <Button type="button" variant="outline" onClick={remove} disabled={busy !== null}>
              {busy === "remove" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Remove
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          tabIndex={-1}
          onChange={e => upload(e.target.files?.[0])}
        />
      </div>
      <div className="mt-3">
        <StatusLine status={status} />
      </div>
    </section>
  )
}

function DetailsSection({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => Promise<void> }) {
  const [name, setName] = useState(profile.name ?? "")
  const [email, setEmail] = useState(profile.email)
  const [currentPassword, setCurrentPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [resendIn, setResendIn] = useState(0)

  const emailChanged = email.trim().toLowerCase() !== profile.email.toLowerCase()
  const nameChanged = name.trim() !== (profile.name ?? "")
  const changed = nameChanged || emailChanged

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(null)
    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Only send the email when it changed, so saving a name doesn't cancel a pending email change
        body: JSON.stringify({ name, ...(emailChanged ? { email, currentPassword } : {}) }),
      })
      if (!res.ok) throw new Error(await readError(res, "Couldn't save your details"))
      const next = (await res.json()) as Profile & { codeSent?: boolean }
      await onSaved(next)
      setName(next.name ?? "")
      setEmail(next.email)
      setCurrentPassword("")
      if (next.codeSent) {
        setResendIn(60)
        setStatus(nameChanged ? { type: "success", text: "Name saved" } : null)
      } else {
        setStatus({ type: "success", text: "Saved" })
      }
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Couldn't save your details" })
    } finally {
      setSaving(false)
    }
  }

  const confirmEmail = async (code: string) => {
    const res = await fetch("/api/profile/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
    if (!res.ok) return readError(res, "That code didn't work")
    const next = (await res.json()) as Profile
    await onSaved(next)
    setEmail(next.email)
    setStatus({ type: "success", text: "Email changed. Use your new email next time you sign in." })
    return null
  }

  const resendEmailCode = async () => {
    const res = await fetch("/api/profile/email/resend", { method: "POST" })
    const body = (await res.json().catch(() => ({}))) as { error?: string; resendIn?: number; retryAfter?: number }
    return { error: res.ok ? undefined : body.error ?? "Couldn't send a new code", resendIn: body.resendIn ?? body.retryAfter }
  }

  const cancelEmailChange = async () => {
    const res = await fetch("/api/profile/email", { method: "DELETE" })
    if (res.ok) await onSaved((await res.json()) as Profile)
    setStatus(null)
  }

  return (
    <section>
      <SectionTitle title="Your details" description="Your name is what classmates see in chat." />
      <form onSubmit={save} className="space-y-5">
        <Field label="Name" htmlFor="profile-name">
          <Input id="profile-name" value={name} onChange={e => setName(e.target.value)} maxLength={60} autoComplete="name" required />
        </Field>
        <Field
          label="Email"
          htmlFor="profile-email"
          hint={emailChanged ? "We'll email a code to the new address to check it works." : "You sign in with this email."}
        >
          <Input
            id="profile-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>
        {emailChanged && (
          <Field label="Current password" htmlFor="profile-current" hint="To keep your account safe, confirm it's you before changing your email.">
            <Input
              id="profile-current"
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={!changed || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {emailChanged ? "Send code" : "Save changes"}
          </Button>
          <StatusLine status={status} />
        </div>
      </form>

      {profile.pendingEmail && (
        <div className="mt-6 rounded-2xl border border-foreground p-5">
          <p className="mb-3 text-sm font-semibold">Confirm your new email</p>
          <CodeEntry
            key={profile.pendingEmail}
            email={profile.pendingEmail}
            initialResendIn={resendIn}
            autoFocus={resendIn > 0}
            submitLabel="Confirm new email"
            onVerify={confirmEmail}
            onResend={resendEmailCode}
            onCancel={cancelEmailChange}
            cancelLabel="Keep my current email"
          />
        </div>
      )}
    </section>
  )
}

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  show,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  autoComplete: string
  show: boolean
}) {
  return (
    <Input
      id={id}
      type={show ? "text" : "password"}
      value={value}
      onChange={e => onChange(e.target.value)}
      autoComplete={autoComplete}
      required
    />
  )
}

function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  const tooShort = next.length > 0 && next.length < 8
  const mismatch = confirm.length > 0 && confirm !== next

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(null)
    if (next.length < 8) return setStatus({ type: "error", text: "Your new password needs at least 8 characters" })
    if (next !== confirm) return setStatus({ type: "error", text: "The new passwords don't match" })
    setSaving(true)
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      if (!res.ok) throw new Error(await readError(res, "Couldn't change your password"))
      setCurrent("")
      setNext("")
      setConfirm("")
      setStatus({ type: "success", text: "Password changed. Use it next time you sign in." })
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Couldn't change your password" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <SectionTitle title="Change password" description="Use at least 8 characters. A short sentence is easier to remember and hard to guess." />
      <form onSubmit={save} className="space-y-5">
        {hasPassword && (
          <Field label="Current password" htmlFor="pw-current">
            <PasswordInput id="pw-current" value={current} onChange={setCurrent} autoComplete="current-password" show={show} />
          </Field>
        )}
        <Field label="New password" htmlFor="pw-new" hint={tooShort ? `${8 - next.length} more character${8 - next.length === 1 ? "" : "s"} needed` : undefined}>
          <PasswordInput id="pw-new" value={next} onChange={setNext} autoComplete="new-password" show={show} />
        </Field>
        <Field label="Confirm new password" htmlFor="pw-confirm" hint={mismatch ? "Doesn't match yet" : undefined}>
          <PasswordInput id="pw-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" show={show} />
        </Field>
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {show ? "Hide passwords" : "Show passwords"}
        </button>
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={saving || !next || !confirm || (hasPassword && !current)}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Change password
          </Button>
          <StatusLine status={status} />
        </div>
      </form>
    </section>
  )
}
