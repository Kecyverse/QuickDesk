'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, where, startAfter, doc, getDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { Search, MessageSquare, CheckCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import TicketDetail from '@/components/dashboard/TicketDetail';
import Pagination from '@/components/ui/Pagination';

// Utility function to format dates safely
const formatDate = (dateValue: any): string => {
  if (!dateValue) return 'No date';
  
  try {
    // Check if it's a Firebase Timestamp
    if (dateValue?.toDate && typeof dateValue.toDate === 'function') {
      return new Date(dateValue.toDate()).toLocaleDateString();
    }
    
    // Check if it's already a Date object
    if (dateValue instanceof Date) {
      return dateValue.toLocaleDateString();
    }
    
    // Try to create a Date from the value
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    return date.toLocaleDateString();
  } catch (error) {
    console.error('Date formatting error:', error, 'Value:', dateValue);
    return 'Invalid date';
  }
};

interface Ticket {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  createdAt: any;
  userId: string;
  userName: string;
  replyCount: number;
  upvotes: number;
  downvotes: number;
}

interface UserVote {
  type: 'upvote' | 'downvote';
  createdAt: any;
}

interface TicketListProps {
  onTicketSelect: (ticketId: string | null) => void;
  selectedTicket: string | null;
  userRole?: string;
}

export default function TicketList({ onTicketSelect, selectedTicket, userRole }: TicketListProps) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [showMyTicketsOnly, setShowMyTicketsOnly] = useState(false);
  const [userVotes, setUserVotes] = useState<Record<string, 'upvote' | 'downvote' | null>>({});
  const [votingTickets, setVotingTickets] = useState<Set<string>>(new Set());
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
    setLastDoc(null);
    fetchTickets(true);
  }, [statusFilter, categoryFilter, sortBy, showMyTicketsOnly]);

  const fetchTickets = async (reset = false) => {
    if (reset) {
      setLoading(true);
      setTickets([]);
      setLastDoc(null);
      setHasMore(true);
    }

    try {
      let q = query(collection(db, 'tickets'));
      
      // Apply filters one at a time to avoid complex composite indexes
      if (statusFilter !== 'all') {
        q = query(q, where('status', '==', statusFilter));
      }
      if (categoryFilter !== 'all') {
        q = query(q, where('category', '==', categoryFilter));
      }
      
      // Apply sorting
      if (sortBy === 'recent') {
        q = query(q, orderBy('createdAt', 'desc'));
      } else if (sortBy === 'replies') {
        q = query(q, orderBy('replyCount', 'desc'));
      }
      
      // Apply pagination
      if (lastDoc && !reset) {
        q = query(q, startAfter(lastDoc));
      }
      q = query(q, limit(itemsPerPage));
      
      const snapshot = await getDocs(q);
      const ticketsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ticket[];
      
      // Filter by user if needed (client-side to avoid complex indexes)
      let filteredData = ticketsData;
      if (showMyTicketsOnly && user) {
        filteredData = ticketsData.filter(ticket => ticket.userId === user.uid);
      }
      
      if (reset) {
        setTickets(filteredData);
        // Fetch user votes for all tickets
        if (user) {
          await fetchUserVotes(filteredData.map(t => t.id));
        }
      } else {
        setTickets(prev => [...prev, ...filteredData]);
        // Fetch user votes for new tickets
        if (user) {
          await fetchUserVotes(filteredData.map(t => t.id));
        }
      }
      
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === itemsPerPage);
      setTotalItems(prev => reset ? filteredData.length : prev + filteredData.length);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserVotes = async (ticketIds: string[]) => {
    if (!user) return;
    
    try {
      const votes: Record<string, 'upvote' | 'downvote' | null> = {};
      
      await Promise.all(
        ticketIds.map(async (ticketId) => {
          try {
            const voteDoc = await getDoc(doc(db, 'tickets', ticketId, 'votes', user.uid));
            if (voteDoc.exists()) {
              const voteData = voteDoc.data() as UserVote;
              votes[ticketId] = voteData.type;
            } else {
              votes[ticketId] = null;
            }
          } catch (error) {
            console.error(`Error fetching vote for ticket ${ticketId}:`, error);
            votes[ticketId] = null;
          }
        })
      );
      
      setUserVotes(prev => ({ ...prev, ...votes }));
    } catch (error) {
      console.error('Error fetching user votes:', error);
    }
  };

  const handleVote = async (ticketId: string, type: 'upvote' | 'downvote') => {
    if (!user || votingTickets.has(ticketId)) return;

    setVotingTickets(prev => new Set(prev).add(ticketId));
    
    try {
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) return;

      const voteRef = doc(db, 'tickets', ticketId, 'votes', user.uid);
      const ticketRef = doc(db, 'tickets', ticketId);
      
      let newUpvotes = ticket.upvotes || 0;
      let newDownvotes = ticket.downvotes || 0;
      const currentVote = userVotes[ticketId];

      if (currentVote === type) {
        // User is unvoting (clicking the same vote type)
        if (type === 'upvote') {
          newUpvotes = Math.max(0, newUpvotes - 1);
        } else {
          newDownvotes = Math.max(0, newDownvotes - 1);
        }
        
        // Remove the vote document
        await deleteDoc(voteRef);
        setUserVotes(prev => ({ ...prev, [ticketId]: null }));
      } else {
        // User is voting or changing their vote
        if (currentVote === 'upvote') {
          // User was upvoted, now voting down
          newUpvotes = Math.max(0, newUpvotes - 1);
          newDownvotes += 1;
        } else if (currentVote === 'downvote') {
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
        setUserVotes(prev => ({ ...prev, [ticketId]: type }));
      }

      // Update the ticket document
      await updateDoc(ticketRef, {
        upvotes: newUpvotes,
        downvotes: newDownvotes,
      });

      // Update local state
      setTickets(prev => prev.map(t => 
        t.id === ticketId 
          ? { ...t, upvotes: newUpvotes, downvotes: newDownvotes }
          : t
      ));
    } catch (error) {
      console.error('Error voting:', error);
    } finally {
      setVotingTickets(prev => {
        const newSet = new Set(prev);
        newSet.delete(ticketId);
        return newSet;
      });
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // For simplicity, we'll reset and fetch from the beginning
    // In a production app, you'd implement cursor-based pagination
    setCurrentPage(1);
    setLastDoc(null);
    fetchTickets(true);
  };

  const filteredTickets = tickets.filter(ticket =>
    ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (selectedTicket) {
    return (
      <TicketDetail
        ticketId={selectedTicket}
        onBack={() => onTicketSelect(null)}
        userRole={userRole}
      />
    );
  }

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg">
      {/* Filters and Search */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">By default On</span>
            </label>
            
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
              />
            </div>
          </div>
          
          <div className="flex space-x-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm"
            >
              <option value="all">Category</option>
              <option value="technical">Technical</option>
              <option value="billing">Billing</option>
              <option value="general">General</option>
              <option value="feature-request">Feature Request</option>
              <option value="bug-report">Bug Report</option>
            </select>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm"
            >
              <option value="all">Status</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm"
            >
              <option value="recent">Sort by</option>
              <option value="recent">Most Recent</option>
              <option value="replies">Most Replies</option>
            </select>
          </div>
        </div>
        
        <div className="mt-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showMyTicketsOnly}
              onChange={(e) => setShowMyTicketsOnly(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Show my tickets only</span>
          </label>
        </div>
      </div>

      {/* Ticket List */}
      <div className="divide-y divide-gray-200">
        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No tickets found
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => onTicketSelect(ticket.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-medium text-gray-900">
                      {ticket.title}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {ticket.description}
                  </p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>By {ticket.userName}</span>
                    <span>•</span>
                    <span className="capitalize">{ticket.category}</span>
                    <span>•</span>
                    <span>{formatDate(ticket.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1 text-gray-500">
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-sm">{ticket.replyCount}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVote(ticket.id, 'upvote');
                      }}
                      disabled={votingTickets.has(ticket.id)}
                      className={`p-1 transition-colors ${
                        userVotes[ticket.id] === 'upvote' 
                          ? 'text-green-600' 
                          : 'text-gray-400 hover:text-green-600'
                      } ${votingTickets.has(ticket.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Upvote"
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </button>
                    <span className="text-sm text-gray-600 min-w-[2rem] text-center">
                      {(ticket.upvotes || 0) - (ticket.downvotes || 0)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVote(ticket.id, 'downvote');
                      }}
                      disabled={votingTickets.has(ticket.id)}
                      className={`p-1 transition-colors ${
                        userVotes[ticket.id] === 'downvote' 
                          ? 'text-red-600' 
                          : 'text-gray-400 hover:text-red-600'
                      } ${votingTickets.has(ticket.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Downvote"
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Handle close ticket
                    }}
                    className="p-1 text-green-600 hover:text-green-700 transition-colors"
                    title="Change close the question if he/she get satisfied answer"
                  >
                    <CheckCircle className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={Math.ceil(totalItems / itemsPerPage)}
        onPageChange={handlePageChange}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
      />
    </div>
  );
} 