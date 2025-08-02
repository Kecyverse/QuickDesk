'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { User } from 'firebase/auth';
import { Bell, LogOut, User as UserIcon, Shield, Plus } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import NotificationSystem from '../ui/NotificationSystem';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface HeaderProps {
  currentView: string;
  onViewChange: (view: string) => void;
  user: User | null;
  userRole?: string;
}

export default function Header({ currentView, onViewChange, user, userRole }: HeaderProps) {
  const { profile } = useUserProfile(user);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Listen for unread notifications
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        where('read', '==', false)
      ),
      (snapshot) => {
        setUnreadCount(snapshot.docs.length);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getPageTitle = () => {
    switch (currentView) {
      case 'dashboard': 
        if (userRole === 'support-agent') return 'Support Dashboard';
        if (userRole === 'admin') return 'Admin Dashboard';
        return 'Dashboard';
      case 'ask': return 'Ask Your Question';
      case 'profile': return 'Profile';
      case 'admin': return 'Admin Panel';
      case 'support': return 'Support Agent Dashboard';
      default: return 'Dashboard';
    }
  };

  const canAccessAdmin = userRole === 'admin';
  const canAccessSupport = userRole === 'support-agent' || userRole === 'admin';

  return (
    <>
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-6">
              <h1 className="text-xl font-semibold text-gray-900">QuickDesk</h1>
              <h2 className="text-lg font-medium text-gray-700">{getPageTitle()}</h2>
              
              {/* Role indicator */}
              {userRole && (
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  userRole === 'admin' ? 'bg-red-100 text-red-800' :
                  userRole === 'support-agent' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {userRole === 'admin' ? 'Admin' :
                   userRole === 'support-agent' ? 'Support Agent' :
                   'End User'}
                </span>
              )}
              
              {/* Show Ask button for all users when on dashboard */}
              {currentView === 'dashboard' && (
                <button
                  onClick={() => onViewChange('ask')}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-1"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Ticket</span>
                </button>
              )}
            </div>

            <div className="flex items-center space-x-4">
              
              <button 
                onClick={() => setNotificationsOpen(true)}
                className="relative p-2 text-gray-400 hover:text-gray-500 transition-colors"
                title="Notifications"
              >
                <Bell className="h-6 w-6" />
                {/* Notification badge - you can add unread count here */}
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {/* Navigation buttons based on role */}
              {canAccessSupport && currentView === 'dashboard' && (
                <button
                  onClick={() => onViewChange('support')}
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Shield className="h-5 w-5" />
                  <span className="text-sm font-medium">Support</span>
                </button>
              )}
              
              {canAccessAdmin && currentView === 'dashboard' && (
                <button
                  onClick={() => onViewChange('admin')}
                  className="flex items-center space-x-2 text-red-600 hover:text-red-700 transition-colors"
                >
                  <Shield className="h-5 w-5" />
                  <span className="text-sm font-medium">Admin</span>
                </button>
              )}
              
              <button
                onClick={() => onViewChange('profile')}
                className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                <UserIcon className="h-5 w-5" />
                <span className="text-sm font-medium">
                  {profile?.name || 'User'}
                </span>
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-red-600 hover:text-red-700 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <NotificationSystem 
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </>
  );
} 