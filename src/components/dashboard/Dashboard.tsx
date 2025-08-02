'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useUserProfile } from '@/hooks/useUserProfile';
import Header from './Header';
import TicketList from './TicketList';
import AskQuestionForm from './AskQuestionForm';
import Profile from '../profile/Profile';
import AdminPanel from '../admin/AdminPanel';
import SupportAgentDashboard from './SupportAgentDashboard';
type View = 'dashboard' | 'ask' | 'profile' | 'admin' | 'support';

export default function Dashboard() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);

  // Determine user role and show appropriate dashboard
  const userRole = profile?.role || 'end-user';

  const renderView = () => {
    switch (currentView) {
      case 'ask':
        return <AskQuestionForm onBack={() => setCurrentView('dashboard')} />;
      case 'profile':
        return <Profile onBack={() => setCurrentView('dashboard')} />;
      case 'admin':
        return <AdminPanel onBack={() => setCurrentView('dashboard')} />;
      case 'support':
        return <SupportAgentDashboard onBack={() => setCurrentView('dashboard')} />;
      default:
        // Show different dashboards based on user role
        if (userRole === 'support-agent') {
          return <SupportAgentDashboard onBack={() => setCurrentView('dashboard')} />;
        } else if (userRole === 'admin') {
          return <AdminPanel onBack={() => setCurrentView('dashboard')} />;
        } else {
          // End user dashboard
          return (
            <TicketList
              onTicketSelect={setSelectedTicket}
              selectedTicket={selectedTicket}
              userRole={userRole}
            />
          );
        }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        currentView={currentView}
        onViewChange={(view: string) => setCurrentView(view as View)}
        user={user}
        userRole={userRole}
      />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {renderView()}
      </main>
    </div>
  );
}  