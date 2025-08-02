import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from 'firebase/auth';

interface UserProfile {
  name: string;
  email: string;
  role: string;
  categoryInterest?: string;
  language: string;
}

export function useUserProfile(user: User | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          setProfile({
            name: userData.name || user?.displayName || user?.email?.split('@')[0] || 'User',
            email: user?.email || '',
            role: userData.role || 'end-user',
            categoryInterest: userData.categoryInterest || '',
            language: userData.language || 'en',
          });
        } else {
          // Create default profile if user doesn't exist in Firestore
          setProfile({
            name: user?.displayName || user?.email?.split('@')[0] || 'User',
            email: user?.email || '',
            role: 'end-user',
            categoryInterest: '',
            language: 'en',
          });
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
        setProfile({
          name: user?.displayName || user?.email?.split('@')[0] || 'User',
          email: user?.email || '',
          role: 'end-user',
          categoryInterest: '',
          language: 'en',
        });
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  return { profile, loading };
} 