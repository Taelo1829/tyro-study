'use client'

import { useState, useEffect } from 'react'
import { Check, X, UserCheck } from 'lucide-react'
import { getPusherClient, userChannel, EVENTS } from '@/lib/pusher'
import type { PendingRequest } from './types'
import { cn } from '@/lib/utils'

interface FriendRequestsProps {
  currentUserId: string
  onAccepted?: (conversationId: string) => void
}

export function FriendRequests({ currentUserId, onAccepted }: FriendRequestsProps) {
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/chat/friends?type=pending')
      .then(r => r.json())
      .then(data => { setRequests(data); setLoading(false) })
  }, [])

  // Real-time: new friend requests
  useEffect(() => {
    const pusher = getPusherClient()
    const channel = pusher.subscribe(userChannel(currentUserId))

    channel.bind(EVENTS.FRIEND_REQUEST, (data: { friendship: PendingRequest; sender: any }) => {
      setRequests(prev => {
        if (prev.find(r => r.id === data.friendship.id)) return prev
        return [{ ...data.friendship, sender: data.sender }, ...prev]
      })
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(userChannel(currentUserId))
    }
  }, [currentUserId])

  async function handleAction(requestId: string, action: 'accept' | 'decline') {
    setProcessing(p => new Set(p).add(requestId))
    try {
      const res = await fetch('/api/chat/friends', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId: requestId, action }),
      })
      if (res.ok) {
        const data = await res.json()
        setRequests(prev => prev.filter(r => r.id !== requestId))
        if (action === 'accept' && data.conversationId) {
          onAccepted?.(data.conversationId)
        }
      }
    } finally {
      setProcessing(p => { const n = new Set(p); n.delete(requestId); return n })
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center py-14 text-center px-4">
        <UserCheck className="w-10 h-10 text-muted-foreground/20 mb-3" />
        <p className="text-sm text-muted-foreground">No pending friend requests</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {requests.map(req => {
        const isProcessing = processing.has(req.id)
        return (
          <div key={req.id} className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
              {req.sender.image
                ? <img src={req.sender.image} alt="" className="w-full h-full object-cover" />
                : (req.sender.name?.charAt(0) ?? '?').toUpperCase()
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{req.sender.name ?? 'Unknown'}</p>
              <p className="text-xs text-muted-foreground truncate">{req.sender.email}</p>
            </div>
            {isProcessing ? "...loading" : <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleAction(req.id, 'accept')}
                disabled={isProcessing}
                className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 flex items-center justify-center transition-colors disabled:opacity-50"
                title="Accept"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleAction(req.id, 'decline')}
                disabled={isProcessing}
                className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center justify-center transition-colors disabled:opacity-50"
                title="Decline"
              >
                <X className="w-4 h-4" />
              </button>
            </div>}
          </div>
        )
      })}
    </div>
  )
}
