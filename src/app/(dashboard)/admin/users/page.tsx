"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { BarChart3, Crown, KeyRound, Search, Shield, ShieldOff, Trash2, Users } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface AdminUser {
  id: string
  name: string | null
  email: string
  role: "STUDENT" | "ADMIN"
  createdAt: string
  lastVisitDate: string | null
  streakDays: number
  isSuperuser: boolean
  _count: { enrollments: number; quizAttempts: number }
}

interface Viewer {
  isSuperuser: boolean
  /** Superusers manage admins (before the first superuser exists, every admin can) */
  canManageAdmins: boolean
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" })

export default function AdminUsersPage() {
  const { data: session } = useSession()
  const myId = session?.user?.id
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [admins, setAdmins] = useState(0)
  const [superusers, setSuperusers] = useState(0)
  const [viewer, setViewer] = useState<Viewer>({ isSuperuser: false, canManageAdmins: false })
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (q: string) => {
    try {
      const res = await fetch(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      if (!res.ok) throw new Error("Could not load users")
      const data = await res.json()
      setUsers(data.users)
      setTotal(data.total)
      setAdmins(data.admins)
      setSuperusers(data.superusers ?? 0)
      if (data.me) setViewer(data.me)
    } catch (err) {
      toast.error("Error", err instanceof Error ? err.message : "Could not load users")
    } finally {
      setLoading(false)
    }
  }, [])

  // Search as you type (debounced)
  useEffect(() => {
    const timer = setTimeout(() => void load(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query, load])

  async function act(user: AdminUser, request: () => Promise<Response>, success: string) {
    setBusyId(user.id)
    try {
      const res = await request()
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Something went wrong")
      toast.success("Done", success)
      await load(query.trim())
    } catch (err) {
      toast.error("Couldn't do that", err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setBusyId(null)
    }
  }

  function toggleRole(user: AdminUser) {
    const role = user.role === "ADMIN" ? "STUDENT" : "ADMIN"
    const label = user.name ?? user.email
    if (role === "ADMIN" && !confirm(`Give ${label} admin access? They'll be able to edit all content and manage users.`)) return
    if (role === "STUDENT" && !confirm(`Remove admin access from ${label}?`)) return
    void act(
      user,
      () => fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }),
      role === "ADMIN" ? `${label} is now an admin` : `${label} is now a student`
    )
  }

  function toggleSuperuser(user: AdminUser) {
    const label = user.name ?? user.email
    const value = !user.isSuperuser
    if (value && !confirm(`Make ${label} a superuser? They'll be able to manage admins, including you.`)) return
    if (!value && !confirm(`Remove superuser from ${label}? They'll stay an admin.`)) return
    void act(
      user,
      () => fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSuperuser: value }),
      }),
      value ? `${label} is now a superuser` : `${label} is no longer a superuser`
    )
  }

  function sendReset(user: AdminUser) {
    if (!confirm(`Email a password-reset link to ${user.email}?`)) return
    void act(
      user,
      () => fetch(`/api/admin/users/${user.id}/reset-password`, { method: "POST" }),
      `Reset link sent to ${user.email}`
    )
  }

  function remove(user: AdminUser) {
    const label = user.name ?? user.email
    if (!confirm(`Permanently delete ${label}? Their progress, quiz history, timetable and chats will be deleted too. This can't be undone.`)) return
    void act(user, () => fetch(`/api/admin/users/${user.id}`, { method: "DELETE" }), `${label} was deleted`)
  }

  return (
    <>
      <Header title="Users" subtitle="Manage accounts, roles and passwords" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          ← Admin
        </Link>
        <div className="ml-auto flex gap-2">
          <span className="rounded-full bg-card px-4 py-2 text-sm shadow-sm">
            <span className="font-semibold">{total}</span> <span className="text-muted-foreground">users</span>
          </span>
          <span className="tint-blue rounded-full px-4 py-2 text-sm">
            <span className="font-semibold">{admins}</span> <span className="text-muted-foreground">admin{admins !== 1 ? "s" : ""}</span>
          </span>
          {superusers > 0 && (
            <span className="rounded-full bg-amber-100 px-4 py-2 text-sm">
              <span className="font-semibold">{superusers}</span>{" "}
              <span className="text-muted-foreground">superuser{superusers !== 1 ? "s" : ""}</span>
            </span>
          )}
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="h-12 bg-card pl-12"
          aria-label="Search users"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading users…</p>
      ) : users.length === 0 ? (
        <Card className="flex flex-col items-center py-12 text-center">
          <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{query ? "No users match that search." : "No users yet."}</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {users.map(user => {
            const isMe = user.id === myId
            const isAdmin = user.role === "ADMIN"
            const lastAdmin = isAdmin && admins <= 1
            const lastSuperuser = user.isSuperuser && superusers <= 1
            const busy = busyId === user.id
            // Changing roles and deleting admins is for superusers (or any admin before the first superuser exists)
            const roleLocked = !viewer.canManageAdmins
            const deleteLocked = isAdmin && !viewer.canManageAdmins

            return (
              <li key={user.id}>
                <Card className={cn("flex flex-col gap-4 p-5 sm:flex-row sm:items-center", busy && "opacity-60")}>
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <span
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-semibold",
                        isAdmin ? "bg-primary text-primary-foreground" : "tint-blue text-foreground"
                      )}
                      aria-hidden="true"
                    >
                      {(user.name ?? user.email).charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold">{user.name ?? "No name"}</p>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                            isAdmin ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}
                        >
                          {isAdmin ? "Admin" : "Student"}
                        </span>
                        {user.isSuperuser && (
                          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                            <Crown className="h-3 w-3" /> Superuser
                          </span>
                        )}
                        {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                      </div>
                      <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Joined {dateFormat.format(new Date(user.createdAt))}
                        {" · "}{user._count.enrollments} module{user._count.enrollments !== 1 ? "s" : ""}
                        {" · "}{user._count.quizAttempts} quiz{user._count.quizAttempts !== 1 ? "zes" : ""}
                        {user.lastVisitDate && <> · Last visit {dateFormat.format(new Date(user.lastVisitDate))}</>}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {user._count.enrollments > 0 && (
                      <Link
                        href={`/admin/users/${user.id}/progress`}
                        className="neo-button flex h-10 items-center gap-2 px-3.5 text-sm font-medium sm:px-4"
                      >
                        <BarChart3 className="h-4 w-4" />
                        Progress
                      </Link>
                    )}
                    {viewer.isSuperuser && isAdmin && (
                      <button
                        type="button"
                        onClick={() => toggleSuperuser(user)}
                        disabled={busy || lastSuperuser}
                        title={lastSuperuser ? "There must be at least one superuser" : undefined}
                        className="neo-button flex h-10 items-center gap-2 px-3.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
                      >
                        <Crown className="h-4 w-4" />
                        {user.isSuperuser ? "Remove superuser" : "Make superuser"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleRole(user)}
                      disabled={busy || roleLocked || (isAdmin && (isMe || lastAdmin || lastSuperuser))}
                      title={
                        roleLocked ? "Only a superuser can change roles"
                          : isAdmin && isMe ? "You can't remove your own admin access"
                            : isAdmin && lastAdmin ? "There must be at least one admin"
                              : lastSuperuser ? "There must be at least one superuser"
                                : undefined
                      }
                      className="neo-button flex h-10 items-center gap-2 px-3.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
                    >
                      {isAdmin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                      {isAdmin ? "Make student" : "Make admin"}
                    </button>
                    <button
                      type="button"
                      onClick={() => sendReset(user)}
                      disabled={busy}
                      title="Email a password-reset link"
                      className="neo-button flex h-10 items-center gap-2 px-3.5 text-sm font-medium disabled:opacity-50 sm:px-4"
                    >
                      <KeyRound className="h-4 w-4" />
                      <span className="sm:hidden">Reset</span>
                      <span className="hidden sm:inline">Reset password</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(user)}
                      disabled={busy || isMe || lastAdmin || lastSuperuser || deleteLocked}
                      aria-label={`Delete ${user.name ?? user.email}`}
                      title={
                        isMe ? "You can't delete your own account here"
                          : deleteLocked ? "Only a superuser can delete admins"
                            : lastAdmin ? "There must be at least one admin"
                              : lastSuperuser ? "There must be at least one superuser"
                                : "Delete user"
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
