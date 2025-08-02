'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { Bell, X, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';

interface Notification {
  id: string;
  type: 'ticket_created' | 'ticket_updated' | 'reply_added' | 'status_changed';
  title: string;
  message: string;
  ticketId?: string;
  createdAt: any;
  read: boolean;
}

interface NotificationSystemProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationSystem({ isOpen, onClose }: NotificationSystemProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    console.log('NotificationSystem: Setting up listener for user:', user.uid);
    setLoading(true);

    // Listen for notifications from the notifications collection
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        limit(20)
      ),
      (snapshot) => {
        console.log('NotificationSystem: Received snapshot with', snapshot.docs.length, 'notifications');
        const allNotifications: Notification[] = [];
        let unreadCount = 0;
        
        snapshot.docs.forEach((doc) => {
          const notificationData = doc.data();
          const notification: Notification = {
            id: doc.id,
            type: notificationData.type || 'ticket_updated',
            title: notificationData.title || 'Notification',
            message: notificationData.message || 'You have a new notification',
            ticketId: notificationData.ticketId,
            createdAt: notificationData.createdAt,
            read: notificationData.read || false,
          };
          allNotifications.push(notification);
          
          if (!notification.read) {
            unreadCount++;
          }
        });

        // Sort by creation date (newest first)
        allNotifications.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });
        
        console.log('NotificationSystem: Loaded notifications:', allNotifications.length, 'Unread:', unreadCount);
        
        setNotifications(allNotifications);
        setUnreadCount(unreadCount);
        setLoading(false);
      },
      (error) => {
        console.error('NotificationSystem: Error listening to notifications:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
      });
      
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      // Update all unread notifications in the database
      const unreadNotifications = notifications.filter(notif => !notif.read);
      const updatePromises = unreadNotifications.map(notif => 
        updateDoc(doc(db, 'notifications', notif.id), { read: true })
      );
      await Promise.all(updatePromises);
      
      setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'ticket_created':
        return <AlertCircle className="h-5 w-5 text-blue-500" />;
      case 'ticket_updated':
        return <MessageSquare className="h-5 w-5 text-green-500" />;
      case 'status_changed':
        return <CheckCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  if (!isOpen) return null;

  console.log('NotificationSystem: Modal isOpen:', isOpen, 'Notifications count:', notifications.length);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative z-10">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Notifications ({notifications.length})
              </h3>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Mark all as read
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Loading notifications...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg border ${
                        notification.read 
                          ? 'bg-gray-50 border-gray-200' 
                          : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            {notification.createdAt?.toDate ? 
                              new Date(notification.createdAt.toDate()).toLocaleString() :
                              new Date(notification.createdAt).toLocaleString()
                            }
                          </p>
                        </div>
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 