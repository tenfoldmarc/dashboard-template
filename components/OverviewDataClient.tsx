'use client';

import { useEffect, useState, useCallback } from 'react';
import StatBox from '@/components/StatBox';
import Link from 'next/link';

interface StripeOverview {
  totalRevenue: number;
  mrr: number;
  fees: number;
  netRevenue: number;
}

interface AdsOverview {
  totalSpend: number;
  cpl: number;
}

interface UsageData {
  totalSpend: number;
  inputTokens: number;
  outputTokens: number;
  billingPeriod: { start: string; end: string };
  note?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  date: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  assigned_to_initials?: string;
  due_date?: string;
  label?: string;
}

function fmtCurrency(n: number) {
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
  return '$' + n.toFixed(0);
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

export default function OverviewDataClient() {
  const [stripe, setStripe] = useState<StripeOverview | null>(null);
  const [ads, setAds] = useState<AdsOverview | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [emailCount, setEmailCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const results = await Promise.allSettled([
      fetch('/api/stripe/overview').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/ads?dateRange=today').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/usage').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/tasks').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/calendar').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/email').then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);

    if (results[0].status === 'fulfilled' && results[0].value) setStripe(results[0].value);
    if (results[1].status === 'fulfilled' && results[1].value) setAds(results[1].value);
    if (results[2].status === 'fulfilled' && results[2].value) setUsage(results[2].value);
    if (results[3].status === 'fulfilled' && results[3].value) setTasks(results[3].value?.tasks || []);
    if (results[4].status === 'fulfilled' && results[4].value) setEvents(results[4].value?.events || []);
    if (results[5].status === 'fulfilled' && results[5].value) setEmailCount(results[5].value?.emails?.length || 0);

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for refresh event from OverviewClient
  useEffect(() => {
    function handleRefresh() {
      loadData();
    }
    window.addEventListener('overview-refresh', handleRefresh);
    return () => window.removeEventListener('overview-refresh', handleRefresh);
  }, [loadData]);

  // Tasks due today
  const today = new Date().toISOString().slice(0, 10);
  const tasksDueToday = tasks.filter(
    (t) => t.due_date && t.due_date.slice(0, 10) === today
  );
  const myTasks = tasks.filter(
    (t) => t.assigned_to_initials === 'MC' && t.status !== 'done'
  );

  // Next 3 events
  const upcomingEvents = events.slice(0, 3);

  // Usage

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-card border border-border bg-card/60 h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-5 gap-4">
        <StatBox
          label="Revenue Today"
          value={stripe ? fmtCurrency(stripe.totalRevenue) : '--'}
          change="This month"
          changeType="up"
          glow="green"
        />
        <StatBox
          label="Ad Spend Today"
          value={ads ? fmtCurrency(ads.totalSpend) : '--'}
          change={ads && ads.cpl > 0 ? `$${ads.cpl.toFixed(2)} CPL` : 'Today'}
          changeType="neutral"
          glow="amber"
        />
        <StatBox
          label="Important Emails"
          value={emailCount.toString()}
          change="Unread"
          changeType={emailCount > 5 ? 'down' : 'neutral'}
          onClick={() => window.open('https://mail.google.com', '_blank')}
        />
        <StatBox
          label="Tasks Due Today"
          value={tasksDueToday.length.toString()}
          change={`${tasks.filter((t) => t.status !== 'done').length} total open`}
          changeType={tasksDueToday.length > 3 ? 'down' : 'neutral'}
        />
        <StatBox
          label="Events Today"
          value={upcomingEvents.length.toString()}
          change="Upcoming"
          changeType="neutral"
        />
      </div>

      {/* Two column: Events + Tasks */}
      <div className="grid grid-cols-2 gap-5">
        {/* Upcoming Events */}
        <div className="rounded-card border border-border bg-card/60 backdrop-blur-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-[1.2rem] tracking-[1px]">UPCOMING EVENTS</h2>
            <Link href="/calendar" className="text-[.72rem] text-accent font-semibold hover:text-accent-hover transition-colors">
              View all
            </Link>
          </div>
          <div className="space-y-2.5">
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted">No upcoming events.</p>
            ) : (
              upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-surface">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[.82rem] font-semibold truncate">{event.title}</div>
                    <div className="text-[.68rem] text-muted">
                      {event.startTime}{event.endTime ? ` - ${event.endTime}` : ''}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tasks Assigned to You */}
        <div className="rounded-card border border-border bg-card/60 backdrop-blur-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-[1.2rem] tracking-[1px]">TASKS ASSIGNED TO YOU</h2>
            <Link href="/tasks" className="text-[.72rem] text-accent font-semibold hover:text-accent-hover transition-colors">
              View board
            </Link>
          </div>
          <div className="space-y-1">
            {myTasks.length === 0 ? (
              <p className="text-sm text-muted">No tasks assigned to you.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-[.68rem] text-muted uppercase tracking-wider">
                    <th className="text-left pb-2 font-medium">Task</th>
                    <th className="text-left pb-2 font-medium w-24">Status</th>
                    <th className="text-left pb-2 font-medium w-24">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {myTasks.slice(0, 8).map((task) => {
                    const statusColor =
                      task.status === 'todo'
                        ? 'text-muted'
                        : task.status === 'in_progress'
                        ? 'text-blue'
                        : task.status === 'review'
                        ? 'text-amber'
                        : 'text-accent';
                    const statusLabel =
                      task.status === 'todo'
                        ? 'To Do'
                        : task.status === 'in_progress'
                        ? 'In Progress'
                        : task.status === 'review'
                        ? 'Review'
                        : task.status;
                    return (
                      <tr key={task.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="py-2 text-[.78rem]">
                          <div className="flex items-center gap-2">
                            {task.label && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                  task.label === 'content'
                                    ? 'bg-accent'
                                    : task.label === 'client'
                                    ? 'bg-blue'
                                    : task.label === 'admin'
                                    ? 'bg-amber'
                                    : 'bg-muted'
                                }`}
                              />
                            )}
                            <span className="truncate">{task.title}</span>
                          </div>
                        </td>
                        <td className={`py-2 text-[.68rem] font-medium ${statusColor}`}>{statusLabel}</td>
                        <td className="py-2 text-[.68rem] text-muted">
                          {task.due_date
                            ? new Date(task.due_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : '--'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Claude API Usage — compact bar at bottom */}
      <a
        href="https://console.anthropic.com/settings/billing"
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-card border border-border bg-card/60 backdrop-blur-xl px-5 py-3 hover:border-[var(--border-hover)] transition-all"
      >
        <div className="flex items-center gap-4">
          <span className="text-[.72rem] font-semibold text-muted uppercase tracking-wider whitespace-nowrap">Claude API</span>
          {usage?.totalSpend ? (
            <div className="flex items-center gap-3 text-[.75rem] font-mono">
              <span className="text-cream">
                Spend: <span className="text-accent">${(usage.totalSpend).toFixed(2)}</span>
              </span>
              <span className="text-muted">|</span>
              <span className="text-cream">
                Input: <span className="text-[var(--text-secondary)]">{fmtTokens(usage.inputTokens || 0)}</span>
              </span>
              <span className="text-muted">|</span>
              <span className="text-cream">
                Output: <span className="text-[var(--text-secondary)]">{fmtTokens(usage.outputTokens || 0)}</span>
              </span>
            </div>
          ) : (
            <span className="text-[.75rem] text-[var(--text-secondary)]">Click to view usage on Anthropic Console</span>
          )}
          <span className="ml-auto text-[.68rem] text-accent font-semibold">View Billing &rarr;</span>
        </div>
      </a>
    </div>
  );
}
