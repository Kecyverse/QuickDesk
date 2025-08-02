'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import LoginForm from '@/components/auth/LoginForm';
import Dashboard from '@/components/dashboard/Dashboard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return <Dashboard />;
}
