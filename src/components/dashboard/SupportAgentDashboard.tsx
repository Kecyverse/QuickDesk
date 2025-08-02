'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, where, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/AuthProvider';
import { Search, MessageSquare, CheckCircle, User, Clock, AlertCircle } from 'lucide-react';
import TicketDetail from '@/components/dashboard/TicketDetail';
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
  replyCount: number;
  upvotes: number;
  downvotes: number;
  assignedTo?: string;
  assignedToName?: string;
}

interface SupportAgentDashboardProps {
  onBack: () => void;
}

export default function SupportAgentDashboard({ onBack }: SupportAgentDashboardProps) {
  const { user } = useAuth();
  const { profile } = useUserProfile(user);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [activeTab, setActiveTab] = useState<'all' | 'my-tickets'>('all');
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, categoryFilter, sortBy]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      let q = query(collection(db, 'tickets'));
      
      // Apply only one filter at a time to avoid composite indexes
      if (statusFilter !== 'all') {
        q = query(q, where('status', '==', statusFilter));
      } else if (categoryFilter !== 'all') {
        q = query(q, where('category', '==', categoryFilter));
      }
      
      // Apply sorting only if no filters are applied
      if (statusFilter === 'all' && categoryFilter === 'all') {
        if (sortBy === 'recent') {
          q = query(q, orderBy('createdAt', 'desc'));
        } else if (sortBy === 'replies') {
          q = query(q, orderBy('replyCount', 'desc'));
        }
      }
      
      q = query(q, limit(50));
      
      const querySnapshot = await getDocs(q);
      const ticketsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ticket[];
      
      setTickets(ticketsData);
      
      // Filter my tickets
      const myTicketsData = ticketsData.filter(ticket => ticket.assignedTo === user?.uid);
      setMyTickets(myTicketsData);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTicket = async (ticketId: string) => {
    if (!user || !profile) return;

    try {
      await updateDoc(doc(db, 'tickets', ticketId), {
        assignedTo: user.uid,
        assignedToName: profile.name,
        status: 'in-progress',
      });
      
      // Send notification to ticket owner
      const ticket = tickets.find(t => t.id === ticketId);
      if (ticket) {
        try {
          // Create in-app notification for ticket owner
          await addDoc(collection(db, 'notifications'), {
            userId: ticket.userId, // Notify the ticket owner
            type: 'ticket_updated',
            title: 'Ticket Assigned',
            message: `Your ticket "${ticket.title}" has been assigned to a support agent`,
            ticketId: ticketId,
            createdAt: new Date(),
            read: false,
          });

          // Send email notification
          await emailService.sendTicketStatusUpdateNotification({
            ticketId: ticketId,
            ticketTitle: ticket.title,
            userName: ticket.userName,
            userEmail: '', // You'd need to get this from user profile
            status: 'in-progress',
          });
        } catch (notificationError) {
          console.error('Error creating notification:', notificationError);
        }
      }
      
      fetchTickets(); // Refresh the list
    } catch (error) {
      console.error('Error assigning ticket:', error);
    }
  };

  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'tickets', ticketId), {
        status: newStatus,
      });

      // Send notification to ticket owner about status change
      const ticket = tickets.find(t => t.id === ticketId);
      if (ticket) {
        try {
          // Create in-app notification for ticket owner
          await addDoc(collection(db, 'notifications'), {
            userId: ticket.userId, // Notify the ticket owner
            type: 'status_changed',
            title: 'Ticket Status Updated',
            message: `Your ticket "${ticket.title}" status has been updated to ${newStatus}`,
            ticketId: ticketId,
            createdAt: new Date(),
            read: false,
          });

          // Send email notification
          await emailService.sendTicketStatusUpdateNotification({
            ticketId: ticketId,
            ticketTitle: ticket.title,
            userName: ticket.userName,
            userEmail: '', // You'd need to get this from user profile
            status: newStatus,
          });
        } catch (notificationError) {
          console.error('Error creating notification:', notificationError);
        }
      }
      
      fetchTickets(); // Refresh the list
    } catch (error) {
      console.error('Error updating ticket status:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="h-4 w-4" />;
      case 'in-progress': return <Clock className="h-4 w-4" />;
      case 'resolved': return <CheckCircle className="h-4 w-4" />;
      case 'closed': return <CheckCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const currentTickets = activeTab === 'my-tickets' ? myTickets : tickets;
  const filteredTickets = currentTickets.filter(ticket =>
    ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedTicket) {
    return (
      <TicketDetail
        ticketId={selectedTicket}
        onBack={() => setSelectedTicket(null)}
        userRole="support-agent"
      />
    );
  }

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Support Agent Dashboard</h2>
            <p className="text-gray-600">Manage and resolve support tickets</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{myTickets.length}</div>
              <div className="text-sm text-gray-500">My Tickets</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">{tickets.filter(t => t.status === 'open').length}</div>
              <div className="text-sm text-gray-500">Open Tickets</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          <button
            onClick={() => setActiveTab('all')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'all'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            All Tickets ({tickets.length})
          </button>
          <button
            onClick={() => setActiveTab('my-tickets')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'my-tickets'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            My Tickets ({myTickets.length})
          </button>
        </nav>
      </div>

      {/* Filters */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
            />
          </div>
          
          <div className="flex space-x-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm"
            >
              <option value="all">All Categories</option>
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
              <option value="all">All Status</option>
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
              <option value="recent">Most Recent</option>
              <option value="replies">Most Replies</option>
            </select>
          </div>
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
              onClick={() => setSelectedTicket(ticket.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-medium text-gray-900">
                      {ticket.title}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center space-x-1 ${getStatusColor(ticket.status)}`}>
                      {getStatusIcon(ticket.status)}
                      <span>{ticket.status}</span>
                    </span>
                    {ticket.assignedTo && (
                      <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full flex items-center space-x-1">
                        <User className="h-3 w-3" />
                        <span>Assigned</span>
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {ticket.description}
                  </p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>By {ticket.userName}</span>
                    <span>•</span>
                    <span className="capitalize">{ticket.category}</span>
                    <span>•</span>
                                         <span>{new Date(ticket.createdAt instanceof Date ? ticket.createdAt : ticket.createdAt?.toDate()).toLocaleDateString()}</span>
                    {ticket.assignedToName && (
                      <>
                        <span>•</span>
                        <span>Assigned to {ticket.assignedToName}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1 text-gray-500">
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-sm">{ticket.replyCount}</span>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2">
                    {!ticket.assignedTo && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAssignTicket(ticket.id);
                        }}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Assign to Me
                      </button>
                    )}
                    
                    {ticket.assignedTo === user?.uid && (
                      <select
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleUpdateStatus(ticket.id, e.target.value);
                        }}
                        value={ticket.status}
                        className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                      >
                        <option value="open">Open</option>
                        <option value="in-progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
} 