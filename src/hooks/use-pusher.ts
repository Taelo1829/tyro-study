// hooks/use-pusher.ts
"use client";

import { useEffect, useState } from 'react';
import { getPusherClient, subscribeToUserChannel } from '@/lib/pusher/client';
import { useSession } from 'next-auth/react';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  link?: string;
  timestamp: string;
}

export function usePusher() {
  const { data: session, status } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;

    const client = getPusherClient();
    if (!client) return;

    // Subscribe to user's private channel
    const channel = subscribeToUserChannel(session.user.id);
    
    if (!channel) return;

    // Connection events
    client.connection.bind('connected', () => {
      console.log('Pusher connected');
      setIsConnected(true);
    });

    client.connection.bind('disconnected', () => {
      console.log('Pusher disconnected');
      setIsConnected(false);
    });

    client.connection.bind('error', (error: any) => {
      console.error('Pusher connection error:', error);
      setIsConnected(false);
    });

    // Bind to notification events
    channel.bind('notification', (data: Notification) => {
      setNotifications(prev => [data, ...prev].slice(0, 50)); // Keep last 50 notifications
      
      // Show browser notification if permitted
      if (Notification.permission === 'granted') {
        new Notification(data.title, {
          body: data.message,
          icon: '/icons/icon-192.png',
        });
      }
    });

    // Cleanup
    return () => {
      channel.unbind_all();
      client.unsubscribe(`private-user-${session.user.id}`);
    };
  }, [session?.user?.id, status]);

  const clearNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  };

  return {
    isConnected,
    notifications,
    clearNotification,
    clearAllNotifications,
    requestNotificationPermission,
  };
}