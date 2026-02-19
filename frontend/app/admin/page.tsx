'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabaseClient';

const API = '';

interface UserProfile {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  };

  const fetchUsers = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.status === 403) {
        setError('Admin access required');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch users');

      const data = await res.json();
      setUsers(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/admin/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create user');
      }

      setNewEmail('');
      setNewPassword('');
      setNewRole('user');
      setShowCreateForm(false);
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const deleteUser = async (userId: string, email: string) => {
    if (!confirm(`Delete user ${email}?`)) return;

    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete user');
      }

      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #2a2a3e',
    background: '#1a1a2e',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff' }}>
      {/* Header */}
      <header
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #2a2a3e',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Admin Panel</h1>
          <button
            onClick={() => router.push('/')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #2a2a3e',
              background: 'transparent',
              color: '#888',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Back to App
          </button>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid #662222',
            background: '#3a1a1a',
            color: '#ff6b6b',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </header>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '16px' }}>
        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: '#3a1a1a',
              border: '1px solid #662222',
              color: '#ff6b6b',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
            <button
              onClick={() => setError('')}
              style={{
                float: 'right',
                background: 'none',
                border: 'none',
                color: '#ff6b6b',
                cursor: 'pointer',
              }}
            >
              x
            </button>
          </div>
        )}

        {/* Users section */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>
            Users ({users.length})
          </h2>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#7c3aed',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {showCreateForm ? 'Cancel' : '+ Add User'}
          </button>
        </div>

        {/* Create user form */}
        {showCreateForm && (
          <form
            onSubmit={createUser}
            style={{
              padding: 20,
              borderRadius: 12,
              background: '#141420',
              border: '1px solid #2a2a3e',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>
                  Email
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  style={inputStyle}
                  placeholder="user@email.com"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>
                  Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  style={inputStyle}
                  placeholder="Min 6 characters"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  style={{ ...inputStyle, width: 140 }}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={creating}
                style={{
                  padding: '10px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: creating ? '#444' : '#7c3aed',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: creating ? 'not-allowed' : 'pointer',
                }}
              >
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        )}

        {/* Users table */}
        {loading ? (
          <p style={{ color: '#888' }}>Loading...</p>
        ) : (
          <div
            style={{
              borderRadius: 12,
              border: '1px solid #2a2a3e',
              overflow: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#141420' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, color: '#888', fontWeight: 500 }}>
                    Email
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, color: '#888', fontWeight: 500 }}>
                    Role
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, color: '#888', fontWeight: 500 }}>
                    Created
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#888', fontWeight: 500 }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    style={{ borderTop: '1px solid #1a1a2e' }}
                  >
                    <td style={{ padding: '12px 16px', fontSize: 14 }}>
                      {user.email}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          background: user.role === 'admin' ? '#7c3aed22' : '#2a2a3e',
                          color: user.role === 'admin' ? '#a78bfa' : '#888',
                        }}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#888' }}>
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {user.role !== 'admin' && (
                        <button
                          onClick={() => deleteUser(user.id, user.email)}
                          style={{
                            padding: '4px 12px',
                            borderRadius: 6,
                            border: '1px solid #662222',
                            background: 'transparent',
                            color: '#ff6b6b',
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
