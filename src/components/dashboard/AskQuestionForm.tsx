'use client';

import { useState } from 'react';
import { addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { emailService } from '@/lib/emailService';

const questionSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.string().min(1, 'Please select a category'),
  tags: z.string().optional(),
});

type QuestionFormData = z.infer<typeof questionSchema>;

interface AskQuestionFormProps {
  onBack: () => void;
}

export default function AskQuestionForm({ onBack }: AskQuestionFormProps) {
  const { user } = useAuth();
  const { profile } = useUserProfile(user);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<QuestionFormData>({
    resolver: zodResolver(questionSchema),
  });

  const onSubmit = async (data: QuestionFormData) => {
    if (!user) return;

    setSubmitting(true);
    setError('');

    try {
      // Create ticket data
      const ticketData = {
        title: data.title,
        description: data.description,
        category: data.category,
        tags: data.tags ? data.tags.split(',').map(tag => tag.trim()) : [],
        status: 'open',
        userId: user.uid,
        userName: profile?.name || 'User',
        createdAt: new Date(),
        replyCount: 0,
        upvotes: 0,
        downvotes: 0,
      };

      // Add ticket to Firestore
      const ticketRef = await addDoc(collection(db, 'tickets'), ticketData);

      // Send email notification
      try {
        await emailService.sendTicketCreatedNotification({
          ticketId: ticketRef.id,
          ticketTitle: data.title,
          userName: profile?.name || 'User',
          userEmail: user.email || '',
          category: data.category,
          description: data.description,
        });
      } catch (emailError) {
        console.error('Error sending email notification:', emailError);
        // Don't fail the ticket creation if email fails
      }

      // Send notification to all support agents and admins
      try {
        const supportUsersQuery = query(
          collection(db, 'users'),
          where('role', 'in', ['support-agent', 'admin'])
        );
        const supportUsersSnapshot = await getDocs(supportUsersQuery);
        
        const notificationPromises = supportUsersSnapshot.docs.map(supportDoc => 
          addDoc(collection(db, 'notifications'), {
            userId: supportDoc.id,
            type: 'ticket_created',
            title: 'New Ticket Created',
            message: `New ticket "${data.title}" created by ${profile?.name}`,
            ticketId: ticketRef.id,
            createdAt: new Date(),
            read: false,
          })
        );
        
        await Promise.all(notificationPromises);
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError);
      }

      reset();
      onBack();
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the ticket');
    } finally {
      setSubmitting(false);
    }
  };

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
        <h2 className="text-2xl font-bold text-gray-900 mb-6">&gt; Ask Your Question</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Question
            </label>
            <input
              {...register('title')}
              type="text"
              id="title"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              placeholder="Enter your question..."
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              {...register('description')}
              id="description"
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              placeholder="Provide detailed description..."
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              {...register('category')}
              id="category"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
            >
              <option value="">Select a category</option>
              <option value="technical">Technical</option>
              <option value="billing">Billing</option>
              <option value="general">General</option>
              <option value="feature-request">Feature Request</option>
              <option value="bug-report">Bug Report</option>
            </select>
            {errors.category && (
              <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <input
              {...register('tags')}
              type="text"
              id="tags"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              placeholder="Enter tags separated by commas..."
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">{error}</div>
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
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 