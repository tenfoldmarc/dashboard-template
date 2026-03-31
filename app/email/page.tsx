'use client';

import { useEffect, useState, useCallback } from 'react';

interface TriagedEmail {
  id: string;
  gmail_id: string;
  thread_id: string;
  subject: string;
  sender_name: string;
  sender_email: string;
  snippet: string;
  full_body: string;
  priority: 'high' | 'medium' | 'low' | 'filtered';
  category: string;
  received_at: string;
}

const PRIORITY_CONFIG: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  high: { bg: 'rgba(239,68,68,.12)', text: '#EF4444', label: 'Business', dot: '#EF4444' },
  medium: { bg: 'rgba(245,158,11,.12)', text: '#F59E0B', label: 'Team', dot: '#F59E0B' },
  low: { bg: 'rgba(59,130,246,.12)', text: '#3B82F6', label: 'Low', dot: '#3B82F6' },
  filtered: { bg: 'rgba(100,116,139,.12)', text: '#64748B', label: 'Filtered', dot: '#64748B' },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMins = Math.floor((now - then) / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

const SENDER_COLORS = [
  'linear-gradient(135deg, #EF4444, #F43F5E)',
  'linear-gradient(135deg, #F59E0B, #F97316)',
  'linear-gradient(135deg, #22C55E, #06B6D4)',
  'linear-gradient(135deg, #3B82F6, #8B5CF6)',
  'linear-gradient(135deg, #8B5CF6, #EC4899)',
  'linear-gradient(135deg, #06B6D4, #3B82F6)',
];

function getSenderColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
}

export default function EmailPage() {
  const [emails, setEmails] = useState<TriagedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [filteredCount, setFilteredCount] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [replySuccess, setReplySuccess] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEmails = useCallback(async () => {
    try {
      const res = await fetch('/api/email');
      const data = await res.json();
      setEmails(data.emails || []);
      setNote(data.note || null);
      setFilteredCount(data.filteredCount || 0);
      setConnected(data.connected !== false);
    } catch {
      // silently fail
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  function toggleExpand(emailId: string) {
    setExpandedId(prev => prev === emailId ? null : emailId);
  }

  async function handleRefresh() {
    setRefreshing(true);
    // Clear cache first, then refetch
    try {
      await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh' }),
      });
    } catch {
      // ignore — will still fetch fresh
    }
    fetchEmails();
  }

  async function sendReply(email: TriagedEmail) {
    const text = replyText[email.id];
    if (!text?.trim()) return;

    setSendingReply(email.id);
    setReplyError(null);

    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reply',
          to: email.sender_email,
          subject: email.subject,
          body: text,
          threadId: email.thread_id,
          messageId: email.gmail_id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setReplyError(data.error || 'Failed to send reply');
        setSendingReply(null);
        return;
      }

      setReplyText(prev => ({ ...prev, [email.id]: '' }));
      setReplySuccess(email.id);
      setTimeout(() => setReplySuccess(null), 4000);

      // Refresh email list after successful reply
      setTimeout(() => fetchEmails(), 1000);
    } catch {
      setReplyError('Network error — could not send reply.');
    }
    setSendingReply(null);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-[2.4rem] tracking-[1.5px]">Email</h1>
          {!loading && (
            <p className="text-[.75rem] text-[var(--text-secondary)] mt-1">
              <span className="text-accent font-semibold">{emails.length} important</span>
              <span className="mx-2 opacity-30">|</span>
              <span className="text-muted">{filteredCount} filtered out</span>
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-[.8rem] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-cream transition-all disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Note banner */}
      {note && (
        <div className="px-4 py-2.5 rounded-lg border border-border bg-card/60 text-[.75rem] text-[var(--text-secondary)]">
          {note}
        </div>
      )}

      {/* Gmail not connected banner */}
      {!loading && !connected && !bannerDismissed && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-[rgba(245,158,11,.25)] bg-[rgba(245,158,11,.06)] text-[.75rem] text-[#F59E0B]">
          <span>Gmail not connected — showing sample data. Add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN to .env.local to connect.</span>
          <button
            onClick={() => setBannerDismissed(true)}
            className="ml-3 flex-shrink-0 text-[#F59E0B] opacity-60 hover:opacity-100 transition-opacity text-[1rem] leading-none"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-center text-muted text-sm py-12">Loading emails...</p>
      ) : emails.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[1.1rem] text-cream font-heading mb-2">Inbox Zero</p>
          <p className="text-[.8rem] text-muted">No important emails right now. Nice work.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map((email, idx) => {
            const isExpanded = expandedId === email.id;
            const priority = PRIORITY_CONFIG[email.priority] || PRIORITY_CONFIG.medium;

            return (
              <div
                key={email.id}
                className="rounded-xl border border-border bg-[var(--surface)] overflow-hidden transition-all hover:border-[var(--border-hover)] animate-fade-in"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                {/* Email header row - clickable */}
                <button
                  onClick={() => toggleExpand(email.id)}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left"
                >
                  {/* Sender avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[.55rem] font-bold text-white flex-shrink-0"
                    style={{ background: getSenderColor(email.sender_name) }}
                  >
                    {getInitials(email.sender_name)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[.82rem] font-semibold text-cream truncate">{email.sender_name}</span>
                      <span
                        className="text-[.55rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: priority.bg, color: priority.text }}
                      >
                        {email.category || priority.label}
                      </span>
                    </div>
                    <p className="text-[.78rem] text-cream truncate">{email.subject}</p>
                    <p className="text-[.68rem] text-muted truncate mt-0.5">{email.snippet}</p>
                  </div>

                  {/* Time + expand indicator */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[.62rem] text-muted">{timeAgo(email.received_at)}</span>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: priority.dot }} />
                  </div>
                </button>

                {/* Expanded view */}
                {isExpanded && (
                  <div
                    className="border-t border-border animate-fade-in"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Full email body */}
                    <div className="px-5 py-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[.72rem] text-[var(--text-secondary)]">From:</span>
                        <span className="text-[.72rem] text-cream">{email.sender_name}</span>
                        <span className="text-[.65rem] text-muted">&lt;{email.sender_email}&gt;</span>
                      </div>
                      <div className="rounded-lg bg-card/60 p-4 mb-4">
                        <p className="text-[.78rem] text-cream whitespace-pre-wrap leading-relaxed">
                          {email.full_body}
                        </p>
                      </div>

                      {/* Reply box */}
                      {connected && (
                        <div className="space-y-2.5">
                          <label className="block text-[.65rem] uppercase tracking-wider text-[var(--text-secondary)]">Reply</label>
                          <textarea
                            value={replyText[email.id] || ''}
                            onChange={(e) => setReplyText(prev => ({ ...prev, [email.id]: e.target.value }))}
                            placeholder="Type your reply..."
                            rows={4}
                            className="w-full px-3 py-2.5 rounded-lg border border-border bg-[var(--surface)] text-cream text-[.82rem] outline-none focus:border-accent transition-colors resize-none"
                          />
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => sendReply(email)}
                              disabled={!replyText[email.id]?.trim() || sendingReply === email.id}
                              className="px-5 py-2 rounded-lg bg-accent text-white text-[.78rem] font-semibold hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {sendingReply === email.id ? 'Sending...' : 'Send Reply'}
                            </button>
                            {replySuccess === email.id && (
                              <span className="text-[.72rem] text-accent animate-fade-in">Reply sent</span>
                            )}
                            {replyError && sendingReply === null && expandedId === email.id && (
                              <span className="text-[.72rem] text-red-400 animate-fade-in">{replyError}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
