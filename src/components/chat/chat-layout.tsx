'use client'

import { useState } from 'react'
import { MessageSquare, Users, UserPlus, ChevronLeft } from 'lucide-react'
import { ConversationList } from './conversation-list'
import { MessageThread } from './message-thread'
import { UserDirectory } from './user-directory'
import { FriendRequests } from './friend-requests'
import type { Conversation, ChatUser } from './types'
import { cn } from '@/lib/utils'

type Tab = 'chats' | 'people' | 'requests'

interface ChatLayoutProps {
  currentUser: ChatUser
}

export function ChatLayout({ currentUser }: ChatLayoutProps) {
  const [tab, setTab] = useState<Tab>('chats')
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [mobileShowThread, setMobileShowThread] = useState(false)

  function handleSelectConversation(conv: Conversation) {
    setSelected(conv)
    setMobileShowThread(true)
  }

  function handleFriendAccepted(conversationId: string) {
    setTab('chats')
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'chats',    label: 'Chats',    icon: MessageSquare },
    { id: 'people',   label: 'People',   icon: Users },
    { id: 'requests', label: 'Requests', icon: UserPlus },
  ]

  return (
    <div className="flex h-full overflow-hidden rounded-xl border border-border bg-card">

      <div className={cn(
        'flex flex-col border-r border-border',
        'w-full lg:w-80 shrink-0',
        mobileShowThread ? 'hidden lg:flex' : 'flex',
      )}>
        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabs.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
                  tab === t.id
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {tab === 'chats' && (
            <ConversationList
              currentUser={currentUser}
              selectedId={selected?.id ?? null}
              onSelect={handleSelectConversation}
            />
          )}
          {tab === 'people' && (
            <UserDirectory
              currentUserId={currentUser.id}
              onRequestSent={() => setTab('requests')}
            />
          )}
          {tab === 'requests' && (
            <FriendRequests
              currentUserId={currentUser.id}
              onAccepted={handleFriendAccepted}
            />
          )}
        </div>
      </div>

      <div className={cn(
        'flex-1 flex flex-col min-w-0',
        mobileShowThread ? 'flex' : 'hidden lg:flex',
      )}>
        {selected ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border shrink-0">
              <button
                onClick={() => setMobileShowThread(false)}
                className="lg:hidden p-1.5 rounded-lg hover:bg-muted"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-sm overflow-hidden shrink-0">
                {selected.other.image
                  ? <img src={selected.other.image} alt="" className="w-full h-full object-cover" />
                  : (selected.other.name?.charAt(0) ?? '?').toUpperCase()
                }
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{selected.other.name ?? selected.other.email}</p>
                <p className="text-xs text-emerald-500">Online</p>
              </div>
            </div>

            {/* Thread */}
            <div className="flex-1 overflow-hidden">
              <MessageThread
                conversationId={selected.id}
                currentUser={currentUser}
                otherUser={selected.other}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-display font-bold text-lg">Your Messages</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Select a conversation or add friends from the People tab to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
