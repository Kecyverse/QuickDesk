'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowLeft, Users, Tag, Plus, Trash2, CheckCircle, XCircle, Edit } from 'lucide-react';

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

interface Category {
  id: string;
  name: string;
  ticketCount: number;
}

interface User {
  id: string;
  email: string;
  role: string;
  name: string;
  createdAt: any;
}

interface RoleUpgradeRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  currentRole: string;
  requestedRole: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  reason: string;
}

interface AdminPanelProps {
  onBack: () => void;
}

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roleRequests, setRoleRequests] = useState<RoleUpgradeRequest[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [activeTab, setActiveTab] = useState<'categories' | 'users' | 'requests'>('categories');
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingEmail, setEditingEmail] = useState('');
  const [editingRole, setEditingRole] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch categories
      const categoriesSnapshot = await getDocs(collection(db, 'categories'));
      const categoriesData = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      setCategories(categoriesData);

      // Fetch users from Firestore
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      setUsers(usersData);

      // Fetch role upgrade requests
      const requestsSnapshot = await getDocs(
        query(collection(db, 'roleUpgradeRequests'), where('status', '==', 'pending'))
      );
      const requestsData = requestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RoleUpgradeRequest[];
      setRoleRequests(requestsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;

    try {
      await addDoc(collection(db, 'categories'), {
        name: newCategory,
        ticketCount: 0,
        createdAt: new Date(),
      });

      setNewCategory('');
      fetchData(); // Refresh the list
    } catch (error) {
      console.error('Error adding category:', error);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      await deleteDoc(doc(db, 'categories', categoryId));
      fetchData(); // Refresh the list
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user.id);
    setEditingName(user.name);
    setEditingEmail(user.email);
    setEditingRole(user.role);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    try {
      await updateDoc(doc(db, 'users', editingUser), {
        name: editingName,
        email: editingEmail,
        role: editingRole,
      });

      setEditingUser(null);
      setEditingName('');
      setEditingEmail('');
      setEditingRole('');
      fetchData(); // Refresh the list
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditingName('');
    setEditingEmail('');
    setEditingRole('');
  };

  const handleRoleRequest = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      const requestRef = doc(db, 'roleUpgradeRequests', requestId);
      const request = roleRequests.find(r => r.id === requestId);
      
      if (!request) return;

      if (action === 'approve') {
        // Update user role
        const userRef = doc(db, 'users', request.userId);
        await updateDoc(userRef, {
          role: request.requestedRole,
        });

        // Update request status
        await updateDoc(requestRef, {
          status: 'approved',
        });
      } else {
        // Update request status
        await updateDoc(requestRef, {
          status: 'rejected',
        });
      }

      fetchData(); // Refresh the list
    } catch (error) {
      console.error('Error handling role request:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

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
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Admin Panel</h2>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('categories')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'categories'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Tag className="inline h-4 w-4 mr-2" />
              Categories
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="inline h-4 w-4 mr-2" />
              Users
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'requests'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="inline h-4 w-4 mr-2" />
              Role Requests ({roleRequests.length})
            </button>
          </nav>
        </div>

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Manage Categories</h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Enter category name..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                />
                <button
                  onClick={handleAddCategory}
                  disabled={!newCategory.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 disabled:opacity-50 flex items-center space-x-2 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div>
                    <h4 className="font-medium text-gray-900">{category.name}</h4>
                    <p className="text-sm text-gray-500">{category.ticketCount} tickets</p>
                  </div>
                  <button
                    onClick={() => handleDeleteCategory(category.id)}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete category"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Manage Users</h3>
            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  {editingUser === user.id ? (
                    // Edit Mode
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          placeholder="Name"
                          className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                        />
                        <input
                          type="email"
                          value={editingEmail}
                          onChange={(e) => setEditingEmail(e.target.value)}
                          placeholder="Email"
                          className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                        />
                        <select
                          value={editingRole}
                          onChange={(e) => setEditingRole(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                        >
                          <option value="user">User</option>
                          <option value="support-agent">Support Agent</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={handleSaveUser}
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center space-x-1"
                        >
                          <CheckCircle className="h-4 w-4" />
                          <span>Save</span>
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center space-x-1"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <>
                      <div>
                        <h4 className="font-medium text-gray-900">{user.name}</h4>
                        <p className="text-sm text-gray-500">{user.email}</p>
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                          user.role === 'admin' ? 'bg-red-100 text-red-800' :
                          user.role === 'support-agent' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role}
                        </span>
                      </div>
                      <button
                        onClick={() => handleEditUser(user)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-1"
                      >
                        <Edit className="h-4 w-4" />
                        <span>Edit</span>
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Role Requests Tab */}
        {activeTab === 'requests' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Role Upgrade Requests</h3>
            <div className="space-y-4">
              {roleRequests.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No pending role upgrade requests</p>
                </div>
              ) : (
                roleRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{request.userName}</h4>
                        <p className="text-sm text-gray-500">{request.userEmail}</p>
                        <div className="flex items-center space-x-2 mt-2">
                          <span className="text-sm text-gray-600">
                            Current: <span className="font-medium">{request.currentRole}</span>
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-sm text-gray-600">
                            Requested: <span className="font-medium">{request.requestedRole}</span>
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          Requested on {formatDate(request.createdAt)}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleRoleRequest(request.id, 'approve')}
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center space-x-1"
                        >
                          <CheckCircle className="h-4 w-4" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleRoleRequest(request.id, 'reject')}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center space-x-1"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 