'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { ArrowLeft, MessageSquare, ThumbsUp, ThumbsDown, Share2, AlertCircle } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { emailService } from '@/lib/emailService';

interface Ticket {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  createdAt: any;
  userId: string;
  userName: string;
  upvotes: number;
  downvotes: number;
}

interface Reply {
  id: string;
  content: string;
  userId: string;
  userName: string;
  createdAt: any;
}

interface UserVote {
  type: 'upvote' | 'downvote';
  createdAt: any;
}

interface TicketDetailProps {
  ticketId: string;
  onBack: () => void;
  userRole?: string;
}

export default function TicketDetail({ ticketId, onBack, userRole }: TicketDetailProps) {
  const { user } = useAuth();
  const { profile } = useUserProfile(user);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [newReply, setNewReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userVote, setUserVote] = useState<'upvote' | 'downvote' | null>(null);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    fetchTicketAndReplies();
    if (user) {
      fetchUserVote();
    }
  }, [ticketId, user]);

  const fetchTicketAndReplies = async () => {
    setLoading(true);
    try {
      // Fetch ticket
      const ticketDoc = await getDoc(doc(db, 'tickets', ticketId));
      if (ticketDoc.exists()) {
        setTicket({ id: ticketDoc.id, ...ticketDoc.data() } as Ticket);
      }

      // Fetch replies
      const repliesQuery = query(
        collection(db, 'tickets', ticketId, 'replies'),
        orderBy('createdAt', 'asc')
      );
      const repliesSnapshot = await getDocs(repliesQuery);
      const repliesData = repliesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reply[];
      setReplies(repliesData);
    } catch (error) {
      console.error('Error fetching ticket details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserVote = async () => {
    if (!user) return;
    
    try {
      const voteDoc = await getDoc(doc(db, 'tickets', ticketId, 'votes', user.uid));
      if (voteDoc.exists()) {
        const voteData = voteDoc.data() as UserVote;
        setUserVote(voteData.type);
      } else {
        setUserVote(null);
      }
    } catch (error) {
      console.error('Error fetching user vote:', error);
    }
  };

  const handleSubmitReply = async () => {
    if (!newReply.trim() || !user || !ticket) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'tickets', ticketId, 'replies'), {
        content: newReply,
        userId: user.uid,
        userName: profile?.name || 'User',
        createdAt: new Date(),
      });

      // Send email notification to ticket owner if reply is from support
      if (userRole === 'support-agent' || userRole === 'admin') {
        try {
          await emailService.sendTicketReplyNotification({
            ticketId: ticketId,
            ticketTitle: ticket.title,
            userName: ticket.userName,
            userEmail: '', // You'd need to get this from user profile
            replyFrom: profile?.name || 'Support Team',
          });
        } catch (emailError) {
          console.error('Error sending email notification:', emailError);
        }
      }

      setNewReply('');
      fetchTicketAndReplies(); // Refresh replies
    } catch (error) {
      console.error('Error adding reply:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (type: 'upvote' | 'downvote') => {
    if (!ticket || !user || voting) return;

    setVoting(true);
    try {
      const voteRef = doc(db, 'tickets', ticketId, 'votes', user.uid);
      const ticketRef = doc(db, 'tickets', ticketId);
      
      let newUpvotes = ticket.upvotes || 0;
      let newDownvotes = ticket.downvotes || 0;

      if (userVote === type) {
        // User is unvoting (clicking the same vote type)
        if (type === 'upvote') {
          newUpvotes = Math.max(0, newUpvotes - 1);
        } else {
          newDownvotes = Math.max(0, newDownvotes - 1);
        }
        
        // Remove the vote document
        await deleteDoc(voteRef);
        setUserVote(null);
      } else {
        // User is voting or changing their vote
        if (userVote === 'upvote') {
          // User was upvoted, now voting down
          newUpvotes = Math.max(0, newUpvotes - 1);
          newDownvotes += 1;
        } else if (userVote === 'downvote') {
          // User was downvoted, now voting up
          newDownvotes = Math.max(0, newDownvotes - 1);
          newUpvotes += 1;
        } else {
          // User is voting for the first time
          if (type === 'upvote') {
            newUpvotes += 1;
          } else {
            newDownvotes += 1;
          }
        }
        
        // Set the vote document
        await setDoc(voteRef, {
          type: type,
          createdAt: new Date(),
        });
        setUserVote(type);
      }

      // Update the ticket document
      await updateDoc(ticketRef, {
        upvotes: newUpvotes,
        downvotes: newDownvotes,
      });

      // Update local state
      setTicket(prev => prev ? {
        ...prev,
        upvotes: newUpvotes,
        downvotes: newDownvotes,
      } : null);
    } catch (error) {
      console.error('Error voting:', error);
    } finally {
      setVoting(false);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/ticket/${ticketId}`;
    navigator.clipboard.writeText(url);
    // You could add a toast notification here
  };

  // Check if user can reply - only admin and support team can reply to any ticket
  const canReply = ticket && (
    userRole === 'support-agent' || 
    userRole === 'admin'
  );

  // Check if user is the ticket owner (for display purposes)
  const isTicketOwner = ticket && ticket.userId === user?.uid;

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center text-gray-500">Ticket not found</div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to tickets</span>
          </button>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleVote('upvote')}
              disabled={voting}
              className={`flex items-center space-x-1 transition-colors ${
                userVote === 'upvote' 
                  ? 'text-green-600' 
                  : 'text-gray-500 hover:text-green-600'
              } ${voting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <ThumbsUp className="h-4 w-4" />
              <span className="text-sm">{ticket.upvotes || 0}</span>
            </button>
            <button
              onClick={() => handleVote('downvote')}
              disabled={voting}
              className={`flex items-center space-x-1 transition-colors ${
                userVote === 'downvote' 
                  ? 'text-red-600' 
                  : 'text-gray-500 hover:text-red-600'
              } ${voting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <ThumbsDown className="h-4 w-4" />
              <span className="text-sm">{ticket.downvotes || 0}</span>
            </button>
            <button
              onClick={handleShare}
              className="flex items-center space-x-1 text-gray-500 hover:text-blue-600"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Ticket Content */}
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{ticket.title}</h1>
        
        <div className="flex items-center space-x-4 text-sm text-gray-500 mb-6">
          <span>By {ticket.userName}</span>
          <span>•</span>
          <span>{new Date(ticket.createdAt?.toDate()).toLocaleDateString()}</span>
          <span>•</span>
          <span className="capitalize">{ticket.category}</span>
          <span>•</span>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
            ticket.status === 'open' ? 'bg-blue-100 text-blue-800' :
            ticket.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
            ticket.status === 'resolved' ? 'bg-green-100 text-green-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {ticket.status}
          </span>
          {isTicketOwner && (
            <>
              <span>•</span>
              <span className="text-blue-600 font-medium">Your Ticket</span>
            </>
          )}
        </div>

        <div className="prose max-w-none mb-8">
          <p className="text-gray-700">{ticket.description}</p>
        </div>

        {/* Replies */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>Replies ({replies.length})</span>
          </h3>
          
          {replies.map((reply) => (
            <div key={reply.id} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="font-medium text-gray-900">{reply.userName}</span>
                    <span className="text-sm text-gray-500">
                      {new Date(reply.createdAt?.toDate()).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-700">{reply.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Reply Form - Only for Admin and Support Team */}
        {canReply ? (
          <div className="mt-8">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Add a reply</h4>
            <div className="space-y-4">
              <textarea
                value={newReply}
                onChange={(e) => setNewReply(e.target.value)}
                placeholder="Type your reply here..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSubmitReply}
                  disabled={!newReply.trim() || submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {submitting ? 'Posting...' : 'Reply'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Show message for end users who cannot reply
          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div>
                <h4 className="text-sm font-medium text-yellow-800">Reply Restricted</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  Only support team members and administrators can reply to tickets. 
                  {isTicketOwner && " You can view updates to your ticket here."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 