import PusherServer from 'pusher'
import PusherClient from 'pusher-js'

// ── Server (used in API routes only) ─────────────────────────────────────────
export const pusherServer = new PusherServer({
  appId:   process.env.PUSHER_APP_ID!,
  key:     process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret:  process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS:  true,
})

// ── Client (used in browser) ──────────────────────────────────────────────────
let _client: PusherClient | null = null

export function getPusherClient(): PusherClient {
  if (typeof window === 'undefined') throw new Error('getPusherClient called on server')
  if (!_client) {
    _client = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      channelAuthorization: {
        endpoint: '/api/pusher/auth',
        transport: 'ajax',
      },
    })
  }
  return _client
}

// ── Channel name helpers ──────────────────────────────────────────────────────

/** Deterministic channel name for a conversation between two users */
export function conversationChannel(conversationId: string) {
  return `private-conversation-${conversationId}`
}

/** Channel for a user's personal notifications (friend requests, etc.) */
export function userChannel(userId: string) {
  return `private-user-${userId}`
}

export const EVENTS = {
  NEW_MESSAGE:          'new-message',
  MESSAGE_READ:         'message-read',
  FRIEND_REQUEST:       'friend-request',
  FRIEND_ACCEPTED:      'friend-accepted',
  TYPING_START:         'typing-start',
  TYPING_STOP:          'typing-stop',
} as const
