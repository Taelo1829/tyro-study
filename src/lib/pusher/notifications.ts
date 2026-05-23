// lib/pusher/notifications.ts
import { pusherServer } from "./server";
import { prisma } from "@/lib/prisma";

interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  link?: string;
}

export async function sendRealTimeNotification(data: NotificationData) {
  try {
    // Send via Pusher
    await pusherServer.trigger(
      `private-user-${data.userId}`,
      'notification',
      {
        id: Date.now(),
        title: data.title,
        message: data.message,
        type: data.type,
        link: data.link,
        timestamp: new Date().toISOString(),
      }
    );

    // Store in database
    await prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        scheduledAt: new Date(),
        isSent: true,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error sending notification:", error);
    return { success: false, error };
  }
}

// Send quiz completion notification
export async function notifyQuizCompleted(userId: string, topicTitle: string, score: number) {
  return sendRealTimeNotification({
    userId,
    title: "Quiz Completed! 🎉",
    message: `You scored ${score}% on "${topicTitle}". ${score >= 70 ? 'Great job!' : 'Keep practicing!'}`,
    type: score >= 70 ? 'success' : 'warning',
    link: `/topics/results`,
  });
}

// Send streak milestone notification
export async function notifyStreakMilestone(userId: string, streakDays: number) {
  let message = '';
  if (streakDays === 7) message = 'Week streak! 🔥';
  else if (streakDays === 30) message = 'Month streak! 👑';
  else if (streakDays === 100) message = '100 days streak! 🏆';
  else message = `${streakDays} day streak! Keep going! 🔥`;
  
  return sendRealTimeNotification({
    userId,
    title: "Streak Milestone!",
    message,
    type: 'success',
  });
}

// Send friend request notification
export async function notifyFriendRequest(userId: string, fromUserName: string) {
  return sendRealTimeNotification({
    userId,
    title: "New Friend Request",
    message: `${fromUserName} sent you a friend request`,
    type: 'info',
    link: `/friends/requests`,
  });
}

// Send study reminder
export async function sendStudyReminder(userId: string, topicTitle: string, scheduledTime: Date) {
  return sendRealTimeNotification({
    userId,
    title: "Study Reminder 📚",
    message: `Time to study "${topicTitle}"! Your session starts at ${scheduledTime.toLocaleTimeString()}`,
    type: 'info',
    link: `/topics`,
  });
}