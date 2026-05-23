// lib/pusher/client.ts
import Pusher from 'pusher-js';

let pusherClient: Pusher | null = null;

export const getPusherClient = () => {
  if (!pusherClient && typeof window !== 'undefined') {
    pusherClient = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: '/api/pusher/auth',
      auth: {
        headers: {
          'Content-Type': 'application/json',
        },
      },
      enabledTransports: ['ws', 'wss'],
      disableStats: true,
    });
  }
  return pusherClient;
};

// For user-specific channels
export const subscribeToUserChannel = (userId: string) => {
  const client = getPusherClient();
  if (!client) return null;
  
  const channelName = `private-user-${userId}`;
  return client.subscribe(channelName);
};

// For topic-specific channels
export const subscribeToTopicChannel = (topicId: string) => {
  const client = getPusherClient();
  if (!client) return null;
  
  const channelName = `private-topic-${topicId}`;
  return client.subscribe(channelName);
};

// For module-specific channels
export const subscribeToModuleChannel = (moduleId: string) => {
  const client = getPusherClient();
  if (!client) return null;
  
  const channelName = `private-module-${moduleId}`;
  return client.subscribe(channelName);
};