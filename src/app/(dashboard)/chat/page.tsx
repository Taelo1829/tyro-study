"use client"
import { redirect } from 'next/navigation'
import { ChatLayout } from '@/components/chat/chat-layout'
import { useEffect, useState } from 'react'
import { getAuthUserId } from '@/lib/auth-session'

export default function ChatPage() {
  const [userdata,setUserData] = useState(null)

  useEffect(()=>{
    getAuthUserId()
  },[])
  // if (!session?.user) redirect('/login')

  // const currentUser = {
  //   id: session.user.id,
  //   name: session.user.name ?? null,
  //   email: session.user.email ?? '',
  //   image: session.user.image ?? null,
  // }

  const currentUser = {
    id: "",
    name: "",
    email: "",
    image: "",
  }


  return (
    <div className="h-[calc(100vh-8rem)] animate-fade-in">
      <ChatLayout currentUser={currentUser} />
    </div>
  )
}
