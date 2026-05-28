export type MessageType = 'TEXT' | 'IMAGE' | 'VOICE'

export interface ChatUser {
  id: string
  name: string | null
  email: string
  image: string | null
}

export interface ChatMessageReply {
  id: string
  senderId: string
  type: MessageType
  content: string | null
  mediaUrl: string | null
  mediaDuration: number | null
  sender: ChatUser
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  type: MessageType
  content: string | null
  mediaUrl: string | null
  mediaDuration: number | null
  replyToId: string | null
  replyTo: ChatMessageReply | null
  readAt: string | null
  createdAt: string
  sender: ChatUser,
  pending?: boolean
}

export interface Conversation {
  id: string
  other: ChatUser
  lastMessage: ChatMessage | null
  unreadCount: number
  updatedAt: string
}

export interface FriendshipStatus {
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  isSender: boolean
  id: string
}

export interface UserWithFriendship extends ChatUser {
  role: string
  friendship: FriendshipStatus | null
}

export interface PendingRequest {
  id: string
  senderId: string
  receiverId: string
  status: string
  createdAt: string
  sender: ChatUser
}
