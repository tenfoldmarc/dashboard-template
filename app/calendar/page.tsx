'use client';

import { useEffect, useState, useCallback } from 'react';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
  attendees: string[];
  location: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getUpcomingDays(): { date: Date; label: string; dateStr: string; isToday: boolean }[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push({
      date: d,
      label: DAY_NAMES[d.getDay()],
      dateStr: d.toISOString().split('T')[0],
      isToday: i === 0,
    });
  }
  return days;
}

function parseTo24h(time: string): { h: number; m: number } | null {
  if (!time || time === 'All day') return null;
  // Already "11:30 PM" format from API
  const match12 = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let h = parseInt(match12[1]);
    const m = parseInt(match12[2]);
    const period = match12[3].toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return { h, m };
  }
  // 24h format "14:30"
  const match24 = time.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) return { h: parseInt(match24[1]), m: parseInt(match24[2]) };
  return null;
}

function formatDuration(start: string, end: string): string {
  if (start === 'All day' || !end) return 'All day';
  const s = parseTo24h(start);
  const e = parseTo24h(end);
  if (!s || !e) return '';
  const totalMins = (e.h * 60 + e.m) - (s.h * 60 + s.m);
  if (totalMins <= 0) return '';
  if (totalMins < 60) return `${totalMins}min`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatTimeDisplay(time: string): string {
  if (!time || time === 'All day') return time || 'All day';
  // If already in "11:30 PM" format, return as-is
  if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(time)) return time;
  const parsed = parseTo24h(time);
  if (!parsed) return time;
  const period = parsed.h >= 12 ? 'PM' : 'AM';
  const hour = parsed.h % 12 || 12;
  return `${hour}:${String(parsed.m).padStart(2, '0')} ${period}`;
}

const TIME_COLORS = [
  'var(--accent)',
  'var(--blue)',
  'var(--violet)',
  'var(--amber)',
  'var(--cyan)',
  'var(--rose)',
];

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [, setConnected] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Quick create form
  const [createTitle, setCreateTitle] = useState('');
  const [createDate, setCreateDate] = useState(new Date().toISOString().split('T')[0]);
  const [createStart, setCreateStart] = useState('09:00');
  const [createEnd, setCreateEnd] = useState('10:00');
  const [createDescription, setCreateDescription] = useState('');
  const [createAttendees, setCreateAttendees] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const weekDays = getUpcomingDays();

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar');
      const data = await res.json();
      setEvents(data.events || []);
      setNote(data.note || null);
      setConnected(data.connected !== false);
    } catch {
      // silently fail
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  function getEventsForDay(dateStr: string) {
    return events.filter(e => e.date === dateStr);
  }

  async function handleCreateEvent() {
    if (!createTitle.trim()) return;
    setCreating(true);
    setCreateError(null);

    try {
      const attendeesList = createAttendees
        .split(',')
        .map(s => s.trim())
        .filter(s => s.includes('@'));

      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createTitle,
          date: createDate,
          startTime: createStart,
          endTime: createEnd,
          description: createDescription || undefined,
          attendees: attendeesList.length > 0 ? attendeesList : undefined,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setCreateError(data.error);
      } else {
        setCreateTitle('');
        setCreateDescription('');
        setCreateAttendees('');
        fetchEvents();
      }
    } catch {
      setCreateError('Failed to create event');
    }
    setCreating(false);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[2.4rem] tracking-[1.5px]">Calendar</h1>
        <button
          onClick={async () => {
            setRefreshing(true);
            await fetchEvents();
            setRefreshing(false);
          }}
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

      {loading ? (
        <p className="text-center text-muted text-sm py-12">Loading calendar...</p>
      ) : (
        <div className="grid grid-cols-3 gap-5" style={{ minHeight: '70vh' }}>
          {/* Left: Week events */}
          <div className="col-span-2 space-y-4">
            {weekDays.map((day, dayIdx) => {
              const dayEvents = getEventsForDay(day.dateStr);
              // Show first 7 days always, hide empty days beyond that
              if (dayEvents.length === 0 && dayIdx >= 7) return null;

              return (
                <div key={day.dateStr} className="animate-fade-in" style={{ animationDelay: `${dayIdx * 50}ms` }}>
                  {/* Day header */}
                  <div className="flex items-center gap-3 mb-2.5">
                    <div
                      className="flex items-center justify-center rounded-lg font-heading text-[1.1rem] font-bold"
                      style={{
                        width: '42px',
                        height: '42px',
                        background: day.isToday ? 'var(--accent)' : 'var(--card)',
                        color: day.isToday ? 'white' : 'var(--text-primary)',
                        border: day.isToday ? 'none' : '1px solid var(--border)',
                      }}
                    >
                      {day.date.getDate()}
                    </div>
                    <div>
                      <p className="text-[.85rem] font-semibold text-cream">
                        {day.isToday ? 'Today' : day.label}
                      </p>
                      <p className="text-[.65rem] text-[var(--text-secondary)]">
                        {day.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    {dayEvents.length > 0 && (
                      <span className="text-[.6rem] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-semibold ml-auto">
                        {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Events */}
                  {dayEvents.length > 0 ? (
                    <div className="space-y-2 ml-[54px]">
                      {dayEvents.map((event, eventIdx) => {
                        const isExpanded = expandedId === event.id;
                        const colorAccent = TIME_COLORS[eventIdx % TIME_COLORS.length];

                        return (
                          <div
                            key={event.id}
                            className="rounded-xl border border-border bg-[var(--surface)] overflow-hidden transition-all hover:border-[var(--border-hover)]"
                          >
                            {/* Clickable header */}
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : event.id)}
                              className="w-full flex items-center gap-3 px-4 py-3 text-left"
                            >
                              <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: colorAccent }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-[.82rem] font-medium text-cream truncate">{event.title}</p>
                                <p className="text-[.68rem] text-[var(--text-secondary)]">
                                  {formatTimeDisplay(event.startTime)}
                                  {event.endTime && ` - ${formatTimeDisplay(event.endTime)}`}
                                  <span className="mx-1.5 opacity-40">|</span>
                                  {formatDuration(event.startTime, event.endTime)}
                                </p>
                              </div>
                              {event.attendees.length > 0 && (
                                <div className="flex -space-x-1.5">
                                  {event.attendees.slice(0, 3).map((a, i) => (
                                    <div
                                      key={i}
                                      className="w-5 h-5 rounded-full flex items-center justify-center text-[.45rem] font-bold text-white border border-[var(--surface)]"
                                      style={{ background: TIME_COLORS[i % TIME_COLORS.length] }}
                                      title={a}
                                    >
                                      {a.substring(0, 2).toUpperCase()}
                                    </div>
                                  ))}
                                  {event.attendees.length > 3 && (
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[.45rem] font-bold text-muted bg-card border border-[var(--surface)]">
                                      +{event.attendees.length - 3}
                                    </div>
                                  )}
                                </div>
                              )}
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="text-muted flex-shrink-0 transition-transform"
                                style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>

                            {/* Expanded details */}
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-1 border-t border-border space-y-2.5 animate-fade-in">
                                {event.location && (
                                  <div className="flex items-center gap-2 text-[.72rem]">
                                    <span className="text-[var(--text-secondary)]">Location:</span>
                                    <span className="text-cream">{event.location}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 text-[.72rem]">
                                  <span className="text-[var(--text-secondary)]">Duration:</span>
                                  <span className="text-cream">{formatDuration(event.startTime, event.endTime)}</span>
                                </div>
                                {event.attendees.length > 0 && (
                                  <div className="text-[.72rem]">
                                    <span className="text-[var(--text-secondary)]">Attendees: </span>
                                    <span className="text-cream">{event.attendees.join(', ')}</span>
                                  </div>
                                )}
                                {event.description && (
                                  <div className="text-[.72rem]">
                                    <span className="text-[var(--text-secondary)] block mb-1">Notes:</span>
                                    <p className="text-cream whitespace-pre-wrap leading-relaxed">{event.description}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[.72rem] text-muted ml-[54px]">No events today</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: Quick Create */}
          <div className="space-y-4">
            <div className="rounded-card border border-border bg-card/60 backdrop-blur-sm p-5 sticky top-8">
              <h2 className="font-heading text-[1.1rem] tracking-[1px] mb-4">Quick Create</h2>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-[.65rem] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Title</label>
                  <input
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder="Event name"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-[var(--surface)] text-cream text-[.82rem] outline-none focus:border-accent transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[.65rem] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Date</label>
                  <input
                    type="date"
                    value={createDate}
                    onChange={(e) => setCreateDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-[var(--surface)] text-cream text-[.82rem] outline-none focus:border-accent transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[.65rem] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Start</label>
                    <input
                      type="time"
                      value={createStart}
                      onChange={(e) => setCreateStart(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-[var(--surface)] text-cream text-[.82rem] outline-none focus:border-accent transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[.65rem] uppercase tracking-wider text-[var(--text-secondary)] mb-1">End</label>
                    <input
                      type="time"
                      value={createEnd}
                      onChange={(e) => setCreateEnd(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-[var(--surface)] text-cream text-[.82rem] outline-none focus:border-accent transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[.65rem] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Description</label>
                  <textarea
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    placeholder="Add notes (optional)"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-[var(--surface)] text-cream text-[.82rem] outline-none focus:border-accent transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[.65rem] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Invite People</label>
                  <input
                    value={createAttendees}
                    onChange={(e) => setCreateAttendees(e.target.value)}
                    placeholder="email@example.com, ..."
                    className="w-full px-3 py-2 rounded-lg border border-border bg-[var(--surface)] text-cream text-[.82rem] outline-none focus:border-accent transition-colors"
                  />
                  <p className="text-[.6rem] text-muted mt-1">Comma-separated emails</p>
                </div>

                {createError && (
                  <p className="text-[.72rem] text-[var(--red)]">{createError}</p>
                )}

                <button
                  onClick={handleCreateEvent}
                  disabled={!createTitle.trim() || creating}
                  className="w-full px-4 py-2.5 rounded-lg bg-accent text-white text-[.82rem] font-semibold hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
