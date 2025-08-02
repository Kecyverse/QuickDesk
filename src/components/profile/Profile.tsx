'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, User, Mail, Shield, Globe } from 'lucide-react';
import { doc, setDoc, getDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUserProfile } from '@/hooks/useUserProfile';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['end-user', 'support-agent', 'admin']),
  categoryInterest: z.string().optional(),
  language: z.string(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileProps {
  onBack: () => void;
}

export default function Profile({ onBack }: ProfileProps) {
  const { user } = useAuth();
  const { profile: userProfile } = useUserProfile(user);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestedRole, setRequestedRole] = useState('support-agent');
  const [upgradeReason, setUpgradeReason] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.displayName || user?.email?.split('@')[0] || '',
      email: user?.email || '',
      role: 'end-user',
      language: 'en',
    },
  });

  // Load existing profile data
  const loadProfile = async () => {
    if (!user) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        reset({
          name: userData.name || user?.displayName || user?.email?.split('@')[0] || '',
          email: user?.email || '',
          role: userData.role || 'end-user',
          categoryInterest: userData.categoryInterest || '',
          language: userData.language || 'en',
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load profile data when component mounts
  useEffect(() => {
    loadProfile();
  }, [user]);

  const watchedRole = watch('role');
  const currentUserRole = userProfile?.role || 'end-user';

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      // Update user profile in Firestore
      const userRef = doc(db, 'users', user.uid);
      
      await setDoc(userRef, {
        name: data.name,
        email: data.email,
        role: data.role,
        categoryInterest: data.categoryInterest || '',
        language: data.language,
        updatedAt: new Date(),
      }, { merge: true }); // merge: true will update existing fields without overwriting
      
      setSuccess('Profile updated successfully!');
      
      // Force a page refresh to update the header and other components
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating the profile');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleUpgradeRequest = async () => {
    if (!user) return;

    if (!upgradeReason.trim()) {
      setError('Please provide a reason for the role upgrade request.');
      return;
    }

    try {
      // Create a role upgrade request
      await addDoc(collection(db, 'roleUpgradeRequests'), {
        userId: user.uid,
        userName: userProfile?.name || 'User',
        userEmail: user.email,
        currentRole: currentUserRole,
        requestedRole: requestedRole,
        status: 'pending',
        createdAt: new Date(),
        reason: upgradeReason.trim(),
      });

      setSuccess('Role upgrade request sent to admin! You will be notified when it is reviewed.');
      setUpgradeReason(''); // Clear the form

      // Send notification to admin about the role upgrade request
      await sendNotificationToAdmin({
        type: 'role_upgrade_request',
        title: 'New Role Upgrade Request',
        message: `${userProfile?.name || 'User'} (${user.email}) has requested a role upgrade from ${currentUserRole} to ${requestedRole}`,
        userId: 'admin', // Send to admin
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Error creating role upgrade request:', error);
      setError('Failed to send role upgrade request. Please try again.');
    }
  };

  const sendNotificationToAdmin = async (notification: any) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        ...notification,
        read: false,
      });
    } catch (error) {
      console.error('Error sending notification to admin:', error);
    }
  };

  // Check if user can change their own role
  const canChangeRole = currentUserRole === 'admin';
  const canRequestUpgrade = currentUserRole === 'end-user';

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to dashboard</span>
          </button>
        </div>
      </div>

      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Profile</h2>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading profile...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              <User className="inline h-4 w-4 mr-2" />
              Name
            </label>
                                    <input
                          {...register('name')}
                          type="text"
                          id="name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                        />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="inline h-4 w-4 mr-2" />
              Email
            </label>
            <input
              {...register('email')}
              type="email"
              id="email"
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
            />
            <p className="mt-1 text-sm text-gray-500">Email cannot be changed</p>
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
              <Shield className="inline h-4 w-4 mr-2" />
              Role
            </label>
            <select
              {...register('role')}
              id="role"
              disabled={!canChangeRole}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                canChangeRole ? 'bg-white text-gray-900' : 'bg-gray-50 text-gray-500'
              }`}
            >
              <option value="end-user">End User</option>
              <option value="support-agent">Support Agent</option>
              <option value="admin">Admin</option>
            </select>
            {!canChangeRole && (
              <p className="mt-1 text-sm text-gray-500">
                Only admins can change roles. Contact an admin to request a role upgrade.
              </p>
            )}
            {errors.role && (
              <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
            )}
          </div>

          {watchedRole === 'end-user' && (
            <div>
              <label htmlFor="categoryInterest" className="block text-sm font-medium text-gray-700 mb-2">
                Category of Interest
              </label>
              <div className="flex space-x-2">
                <select
                  {...register('categoryInterest')}
                  id="categoryInterest"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                >
                  <option value="">Select category</option>
                  <option value="technical">Technical</option>
                  <option value="billing">Billing</option>
                  <option value="general">General</option>
                </select>
              </div>
              
              {/* Role Upgrade Request Section */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-3">Request Role Upgrade</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-blue-700 mb-1">
                      Current Role: <span className="font-normal">{currentUserRole}</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-blue-700 mb-1">
                      Request Upgrade To:
                    </label>
                    <div className="flex space-x-3">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="requestedRole"
                          value="end-user"
                          checked={requestedRole === 'end-user'}
                          onChange={(e) => setRequestedRole(e.target.value)}
                          disabled
                          className="mr-2 text-blue-600"
                        />
                        <span className="text-sm text-blue-700">End User (Current)</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="requestedRole"
                          value="support-agent"
                          checked={requestedRole === 'support-agent'}
                          onChange={(e) => setRequestedRole(e.target.value)}
                          className="mr-2 text-blue-600"
                        />
                        <span className="text-sm text-blue-700">Support Agent</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-blue-700 mb-1">
                      Reason for Upgrade:
                    </label>
                    <textarea
                      value={upgradeReason}
                      onChange={(e) => setUpgradeReason(e.target.value)}
                      placeholder="Please explain why you need this role upgrade..."
                      rows={3}
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRoleUpgradeRequest}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    Request Upgrade to Support Agent
                  </button>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  Your request will be reviewed by an admin. You'll be notified of the decision.
                </p>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
              <Globe className="inline h-4 w-4 mr-2" />
              Language
            </label>
                                    <select
                          {...register('language')}
                          id="language"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                        >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </select>
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          {success && (
            <div className="text-green-600 text-sm">{success}</div>
          )}

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Updating...' : 'Update'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
} 