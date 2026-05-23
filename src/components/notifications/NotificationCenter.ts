// // components/notifications/NotificationCenter.tsx
// "use client";

// import { useState, useEffect } from 'react';
// import { Bell, X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
// import { usePusher } from '@/hooks/use-pusher';
// import { Button } from '@/components/ui/button';
// import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
// import { ScrollArea } from '@/components/ui/scroll-area';
// import { cn } from '@/lib/utils';

// const notificationIcons = {
//   success: CheckCircle,
//   warning: AlertTriangle,
//   error: AlertCircle,
//   info: Info,
// };

// export function NotificationCenter() {
//   const { 
//     isConnected, 
//     notifications, 
//     clearNotification, 
//     clearAllNotifications,
//     requestNotificationPermission 
//   } = usePusher();
  
//   const [hasPermission, setHasPermission] = useState(false);
//   const unreadCount = notifications.length;

//   useEffect(() => {
//     if ('Notification' in window && Notification.permission === 'granted') {
//       setHasPermission(true);
//     }
//   }, []);

//   const handleRequestPermission = async () => {
//     const granted = await requestNotificationPermission();
//     setHasPermission(granted);
//   };

//   return (
//     <Popover>
//       <PopoverTrigger asChild>
//         <Button variant="ghost" size="icon" className="relative">
//           <Bell className="h-5 w-5" />
//           {unreadCount > 0 && (
//             <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
//               {unreadCount > 9 ? '9+' : unreadCount}
//             </span>
//           )}
//           {!isConnected && (
//             <span className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-gray-400" />
//           )}
//         </Button>
//       </PopoverTrigger>
      
//       <PopoverContent className="w-80 p-0" align="end">
//         <div className="flex items-center justify-between p-4 border-b">
//           <h3 className="font-semibold">Notifications</h3>
//           <div className="flex gap-2">
//             {!hasPermission && (
//               <Button size="sm" variant="ghost" onClick={handleRequestPermission}>
//                 Enable
//               </Button>
//             )}
//             {notifications.length > 0 && (
//               <Button size="sm" variant="ghost" onClick={clearAllNotifications}>
//                 Clear all
//               </Button>
//             )}
//           </div>
//         </div>
        
//         <ScrollArea className="h-96">
//           {notifications.length === 0 ? (
//             <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
//               <Bell className="h-8 w-8 mb-2 opacity-50" />
//               <p className="text-sm">No notifications</p>
//             </div>
//           ) : (
//             <div className="divide-y">
//               {notifications.map((notification) => {
//                 const Icon = notificationIcons[notification.type];
//                 return (
//                   <div key={notification.id} className="p-4 hover:bg-muted/50 relative group">
//                     <div className="flex gap-3">
//                       <div className={cn(
//                         "mt-0.5",
//                         notification.type === 'success' && "text-green-500",
//                         notification.type === 'warning' && "text-yellow-500",
//                         notification.type === 'error' && "text-red-500",
//                         notification.type === 'info' && "text-blue-500"
//                       )}>
//                         <Icon className="h-4 w-4" />
//                       </div>
//                       <div className="flex-1 min-w-0">
//                         <p className="text-sm font-medium">{notification.title}</p>
//                         <p className="text-xs text-muted-foreground mt-1">
//                           {notification.message}
//                         </p>
//                         <p className="text-xs text-muted-foreground mt-1">
//                           {new Date(notification.timestamp).toLocaleTimeString()}
//                         </p>
//                       </div>
//                       <Button
//                         size="icon-sm"
//                         variant="ghost"
//                         className="opacity-0 group-hover:opacity-100 transition-opacity"
//                         onClick={() => clearNotification(notification.id)}
//                       >
//                         <X className="h-3 w-3" />
//                       </Button>
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           )}
//         </ScrollArea>
//       </PopoverContent>
//     </Popover>
//   );
// }