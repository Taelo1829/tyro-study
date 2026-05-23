'use client'

import { useState, useEffect } from 'react'
import { UserPlus, UserCheck, Clock, UserX, Search, Users } from 'lucide-react'
import type { UserWithFriendship } from './types'
import { cn } from '@/lib/utils'

interface UserDirectoryProps {
  currentUserId: string
  onRequestSent?: () => void
}

function Avatar({ user, size = 'md' }: { user: { name?: string | null; image?: string | null }; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
  return (
    <div className={cn('rounded-full gradient-primary flex items-center justify-center font-bold shrink-0 overflow-hidden', s)}>
      {user.image
        ? <img src={user.image} alt="" className="w-full h-full object-cover" />
        : (user.name?.charAt(0) ?? '?').toUpperCase()
      }
    </div>
  )
}

export function UserDirectory({ currentUserId, onRequestSent }: UserDirectoryProps) {
  const [users, setUsers] = useState<UserWithFriendship[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/chat/friends?type=users')
      .then(r => r.json())
      .then(data => { setUsers(data); setLoading(false) })
  }, [])

  async function sendRequest(userId: string) {
    setPending(p => new Set(p).add(userId))
    try {
      const res = await fetch('/api/chat/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: userId }),
      })
      if (res.ok) {
        setUsers(prev => prev.map(u =>
          u.id === userId
            ? { ...u, friendship: { status: 'PENDING', isSender: true, id: '' } }
            : u
        ))
        onRequestSent?.()
      }
    } finally {
      setPending(p => { const n = new Set(p); n.delete(userId); return n })
    }
  }

  async function cancelRequest(userId: string, friendshipId: string) {
    setPending(p => new Set(p).add(userId))
    try {
      const res = await fetch('/api/chat/friends', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId }),
      })
      if (res.ok) {
        setUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, friendship: null } : u
        ))
      }
    } finally {
      setPending(p => { const n = new Set(p); n.delete(userId); return n })
    }
  }

  const filtered = users.filter(u =>
    !query ||
    u.name?.toLowerCase().includes(query.toLowerCase()) ||
    u.email.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search people…"
            className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center px-4">
            <Users className="w-10 h-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">No users found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(user => {
              const f = user.friendship
              const isLoading = pending.has(user.id)

              return (
                <div key={user.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                  <Avatar user={user} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name ?? 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>

                  {/* Action button */}
                  {!f && (
                    <button
                      onClick={() => sendRequest(user.id)}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-primary text-xs font-medium disabled:opacity-60 shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {isLoading ? "...loading" : "Add"}
                    </button>
                  )}

                  {f?.status === 'PENDING' && f.isSender && (
                    <button
                      onClick={() => cancelRequest(user.id, f.id)}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium disabled:opacity-60 shrink-0 hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="Cancel request"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      Pending
                    </button>
                  )}

                  {f?.status === 'PENDING' && !f.isSender && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                      Requested you
                    </span>
                  )}

                  {f?.status === 'ACCEPTED' && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium shrink-0">
                      <UserCheck className="w-3.5 h-3.5" />
                      Friends
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
