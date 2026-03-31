'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/ToastProvider';
import { createClient } from '@/lib/supabase/client';

interface TeamUser {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

interface UserRole {
  id: string;
  user_id: string;
  email: string;
  role: 'admin' | 'member';
  display_name: string | null;
  page_access: string[];
  created_at: string;
}

const PAGE_OPTIONS = [
  { slug: 'overview', label: 'Overview' },
  { slug: 'financials', label: 'Revenue' },
  { slug: 'content', label: 'Content' },
  { slug: 'tasks', label: 'Tasks' },
  { slug: 'calendar', label: 'Calendar' },
  { slug: 'email', label: 'Email' },
  { slug: 'ads', label: 'Facebook Ads' },
  { slug: 'schedule', label: 'Schedule' },
  { slug: 'settings', label: 'Settings' },
];

const ALL_PAGES = PAGE_OPTIONS.map(p => p.slug);
const MEMBER_DEFAULT_PAGES = ['overview', 'tasks', 'calendar'];

export default function SettingsPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // New user form
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [creating, setCreating] = useState(false);

  // Reset password modal
  const [resetModal, setResetModal] = useState<TeamUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Roles
  const [userRoles, setUserRoles] = useState<Record<string, UserRole>>({});
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // New user role/access
  const [newUserRole, setNewUserRole] = useState<'admin' | 'member'>('member');
  const [newUserPageAccess, setNewUserPageAccess] = useState<string[]>(MEMBER_DEFAULT_PAGES);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/users/roles');
      if (!res.ok) return;
      const data: UserRole[] = await res.json();
      const map: Record<string, UserRole> = {};
      data.forEach(r => { map[r.user_id] = r; });
      setUserRoles(map);
    } catch {
      // silently fail
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data);
    } catch {
      showToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    // Get current user
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
    fetchUsers();
    fetchRoles();
  }, [fetchUsers, fetchRoles]);

  async function saveRole(userId: string, email: string, role: 'admin' | 'member', pageAccess: string[], displayName?: string | null) {
    try {
      const res = await fetch('/api/users/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          email,
          role,
          display_name: displayName || null,
          page_access: role === 'admin' ? ALL_PAGES : pageAccess,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save role');
      }
      showToast(`Role updated for ${email}`, 'success');
      fetchRoles();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save role', 'error');
    }
  }

  function getUserRole(userId: string): 'admin' | 'member' {
    return userRoles[userId]?.role || 'admin';
  }

  function getUserPageAccess(userId: string): string[] {
    return userRoles[userId]?.page_access || ALL_PAGES;
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          displayName: newDisplayName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');

      // Save role for the new user
      await saveRole(
        data.id,
        data.email,
        newUserRole,
        newUserRole === 'admin' ? ALL_PAGES : newUserPageAccess,
        newDisplayName || null,
      );

      showToast(`User ${data.email} created`, 'success');
      setNewEmail('');
      setNewPassword('');
      setNewDisplayName('');
      setNewUserRole('member');
      setNewUserPageAccess(MEMBER_DEFAULT_PAGES);
      fetchUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create user', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleResetPassword() {
    if (!resetModal) return;
    setResetting(true);
    try {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resetModal.id, newPassword: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      showToast(`Password reset for ${resetModal.email}`, 'success');
      setResetModal(null);
      setResetPassword('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reset password', 'error');
    } finally {
      setResetting(false);
    }
  }

  async function handleDeleteUser(userId: string) {
    setDeleting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove user');
      showToast('User removed', 'success');
      setDeleteConfirm(null);
      fetchUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove user', 'error');
    } finally {
      setDeleting(false);
    }
  }

  function fmtDate(dateStr: string | null) {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  };

  function handleInputFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = 'var(--accent)';
    e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-glow)';
  }

  function handleInputBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = 'var(--border)';
    e.currentTarget.style.boxShadow = 'none';
  }

  return (
    <div className="min-h-screen p-6 md:p-10 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="font-heading text-2xl font-bold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Settings
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Manage team access
        </p>
      </div>

      {/* Team Members Card */}
      <div
        className="rounded-card mb-8"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2
            className="font-heading text-[15px] font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Team Members
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            {users.length} user{users.length !== 1 ? 's' : ''} with dashboard access
          </p>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center">
            <div
              className="inline-block w-5 h-5 border-2 rounded-full animate-spin"
              style={{
                borderColor: 'var(--border)',
                borderTopColor: 'var(--accent)',
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr
                  className="text-[11px] font-semibold tracking-wider uppercase"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <th className="text-left px-6 py-3">Email</th>
                  <th className="text-left px-6 py-3">Role</th>
                  <th className="text-left px-6 py-3">Display Name</th>
                  <th className="text-left px-6 py-3">Last Sign In</th>
                  <th className="text-right px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const userRole = getUserRole(user.id);
                  const userAccess = getUserPageAccess(user.id);
                  const isExpanded = expandedUser === user.id;
                  return (
                  <React.Fragment key={user.id}>
                  <tr
                    className="border-t transition-colors duration-150"
                    style={{ borderColor: 'var(--border)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--card-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '';
                    }}
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ background: 'var(--accent)' }}
                        >
                          {(user.email?.[0] || '?').toUpperCase()}
                        </div>
                        <span
                          className="text-[13px] font-medium"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {user.email}
                        </span>
                        {user.id === currentUserId && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{
                              background: 'var(--accent-glow)',
                              color: 'var(--accent)',
                            }}
                          >
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={userRole}
                          onChange={(e) => {
                            const newRole = e.target.value as 'admin' | 'member';
                            const newAccess = newRole === 'admin' ? ALL_PAGES : MEMBER_DEFAULT_PAGES;
                            saveRole(user.id, user.email, newRole, newAccess, user.display_name);
                          }}
                          className="text-[12px] font-semibold px-2.5 py-1 rounded-lg outline-none cursor-pointer transition-all duration-200"
                          style={{
                            background: userRole === 'admin' ? 'var(--accent-glow)' : 'var(--surface)',
                            color: userRole === 'admin' ? 'var(--accent)' : 'var(--text-secondary)',
                            border: `1px solid ${userRole === 'admin' ? 'var(--accent)' : 'var(--border)'}`,
                          }}
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                        {userRole === 'member' && (
                          <button
                            onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                            className="text-[11px] font-medium px-2 py-1 rounded-md transition-all duration-200"
                            style={{
                              color: 'var(--text-muted)',
                              background: isExpanded ? 'var(--surface)' : 'transparent',
                              border: '1px solid var(--border)',
                            }}
                          >
                            {isExpanded ? 'Hide access' : 'Edit access'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td
                      className="px-6 py-3 text-[13px]"
                      style={{ color: user.display_name ? 'var(--text-secondary)' : 'var(--text-muted)' }}
                    >
                      {user.display_name || '--'}
                    </td>
                    <td
                      className="px-6 py-3 text-[13px]"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {fmtDate(user.last_sign_in_at)}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setResetModal(user);
                            setResetPassword('');
                          }}
                          className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all duration-200"
                          style={{
                            color: 'var(--text-secondary)',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent)';
                            e.currentTarget.style.color = 'var(--accent)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }}
                        >
                          Reset Password
                        </button>
                        {user.id !== currentUserId && (
                          <>
                            {deleteConfirm === user.id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  disabled={deleting}
                                  className="text-[12px] font-semibold px-3 py-1.5 rounded-lg text-white transition-all duration-200 disabled:opacity-50"
                                  style={{ background: 'var(--red)' }}
                                >
                                  {deleting ? 'Removing...' : 'Confirm'}
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all duration-200"
                                  style={{
                                    color: 'var(--text-muted)',
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(user.id)}
                                className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-all duration-200"
                                style={{
                                  color: 'var(--red)',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid transparent',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                }}
                              >
                                Remove
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Page access toggles row */}
                  {isExpanded && userRole === 'member' && (
                    <tr style={{ borderColor: 'var(--border)' }}>
                      <td colSpan={5} className="px-6 py-4" style={{ background: 'var(--surface)' }}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            Page Access
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {PAGE_OPTIONS.map((page) => {
                            const isOn = userAccess.includes(page.slug);
                            return (
                              <label
                                key={page.slug}
                                className="flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200"
                                style={{
                                  background: 'var(--card)',
                                  border: `1px solid ${isOn ? 'var(--accent)' : 'var(--border)'}`,
                                }}
                              >
                                <span className="text-[12px] font-medium" style={{ color: isOn ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                  {page.label}
                                </span>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={isOn}
                                  onClick={() => {
                                    const newAccess = isOn
                                      ? userAccess.filter(s => s !== page.slug)
                                      : [...userAccess, page.slug];
                                    saveRole(user.id, user.email, 'member', newAccess, user.display_name);
                                  }}
                                  className="relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0"
                                  style={{
                                    background: isOn ? 'var(--accent)' : 'var(--border)',
                                  }}
                                >
                                  <span
                                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm"
                                    style={{
                                      left: '2px',
                                      transform: isOn ? 'translateX(16px)' : 'translateX(0)',
                                    }}
                                  />
                                </button>
                              </label>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add New User Card */}
      <div
        className="rounded-card max-w-lg"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2
            className="font-heading text-[15px] font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Add New User
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            Create a new team member account
          </p>
        </div>
        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
          <div>
            <label
              className="block text-[12px] font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Email Address
            </label>
            <input
              type="email"
              placeholder="team@yourcompany.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200"
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>
          <div>
            <label
              className="block text-[12px] font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Password
            </label>
            <input
              type="password"
              placeholder="Minimum 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200"
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>
          <div>
            <label
              className="block text-[12px] font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Display Name{' '}
              <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Jane Smith"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200"
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>
          {/* Role selector */}
          <div>
            <label
              className="block text-[12px] font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Role
            </label>
            <select
              value={newUserRole}
              onChange={(e) => {
                const r = e.target.value as 'admin' | 'member';
                setNewUserRole(r);
                if (r === 'admin') setNewUserPageAccess(ALL_PAGES);
                else setNewUserPageAccess(MEMBER_DEFAULT_PAGES);
              }}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200"
              style={inputStyle}
            >
              <option value="admin">Admin - Full access</option>
              <option value="member">Member - Restricted access</option>
            </select>
          </div>

          {/* Page access toggles (member only) */}
          {newUserRole === 'member' && (
            <div>
              <label
                className="block text-[12px] font-medium mb-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                Page Access
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PAGE_OPTIONS.map((page) => {
                  const isOn = newUserPageAccess.includes(page.slug);
                  return (
                    <label
                      key={page.slug}
                      className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all duration-200"
                      style={{
                        background: 'var(--surface)',
                        border: `1px solid ${isOn ? 'var(--accent)' : 'var(--border)'}`,
                      }}
                    >
                      <span className="text-[12px] font-medium" style={{ color: isOn ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {page.label}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isOn}
                        onClick={() => {
                          setNewUserPageAccess(prev =>
                            isOn ? prev.filter(s => s !== page.slug) : [...prev, page.slug]
                          );
                        }}
                        className="relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0"
                        style={{ background: isOn ? 'var(--accent)' : 'var(--border)' }}
                      >
                        <span
                          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm"
                          style={{
                            left: '2px',
                            transform: isOn ? 'translateX(16px)' : 'translateX(0)',
                          }}
                        />
                      </button>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {newUserRole === 'admin' && (
            <div
              className="rounded-xl px-4 py-3 text-[12px] font-medium"
              style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
            >
              Full access to all pages
            </div>
          )}

          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50"
            style={{
              background: 'var(--accent)',
              boxShadow: '0 4px 16px rgba(99, 91, 255, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
            }}
          >
            {creating ? 'Creating...' : 'Create User'}
          </button>
        </form>
      </div>

      {/* Reset Password Modal */}
      {resetModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setResetModal(null);
              setResetPassword('');
            }
          }}
        >
          <div
            className="w-full max-w-[400px] rounded-card p-6 animate-fade-in-scale mx-4"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <h3
              className="font-heading text-[15px] font-semibold mb-1"
              style={{ color: 'var(--text-primary)' }}
            >
              Reset Password
            </h3>
            <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
              Set a new password for this user
            </p>

            <div className="mb-4">
              <label
                className="block text-[12px] font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                User
              </label>
              <div
                className="rounded-xl px-4 py-3 text-sm"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                }}
              >
                {resetModal.email}
              </div>
            </div>

            <div className="mb-6">
              <label
                className="block text-[12px] font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                New Password
              </label>
              <input
                type="password"
                placeholder="Minimum 6 characters"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                minLength={6}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setResetModal(null);
                  setResetPassword('');
                }}
                className="flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetting || resetPassword.length < 6}
                className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50"
                style={{
                  background: 'var(--accent)',
                  boxShadow: '0 4px 16px rgba(99, 91, 255, 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--accent)';
                }}
              >
                {resetting ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
