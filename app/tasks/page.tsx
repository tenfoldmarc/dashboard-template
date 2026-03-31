'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface KanbanTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  label: string;
  assigned_to: string | null;
  assigned_to_initials: string | null;
  created_by: string;
  position: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS = [
  { key: 'todo', label: 'To Do', accent: 'var(--blue)' },
  { key: 'in_progress', label: 'In Progress', accent: 'var(--amber)' },
  { key: 'review', label: 'Review', accent: 'var(--violet)' },
  { key: 'done', label: 'Done', accent: 'var(--accent)' },
];

const LABELS: Record<string, { bg: string; text: string; label: string }> = {
  content: { bg: 'rgba(59,130,246,.15)', text: '#3B82F6', label: 'Content' },
  dev: { bg: 'rgba(34,197,94,.15)', text: '#22C55E', label: 'Dev' },
  design: { bg: 'rgba(139,92,246,.15)', text: '#8B5CF6', label: 'Design' },
  urgent: { bg: 'rgba(239,68,68,.15)', text: '#EF4444', label: 'Urgent' },
};

interface TeamMember {
  name: string;
  initials: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const FALLBACK_MEMBERS: TeamMember[] = [
  { name: 'Owner', initials: 'OW' },
  { name: 'Unassigned', initials: '' },
];

const AVATAR_GRADIENTS: Record<string, string> = {
  MC: 'linear-gradient(135deg, #22C55E, #06B6D4)',
  JD: 'linear-gradient(135deg, #8B5CF6, #F43F5E)',
  default: 'linear-gradient(135deg, #64748B, #475569)',
};

function getAvatarGradient(initials: string) {
  return AVATAR_GRADIENTS[initials] || AVATAR_GRADIENTS.default;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const draggedTaskRef = useRef<string | null>(null);
  const dragSourceColumnRef = useRef<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(FALLBACK_MEMBERS);

  // New task form
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLabel, setNewLabel] = useState('content');
  const [newAssignee, setNewAssignee] = useState('MC');
  const [newDueDate, setNewDueDate] = useState('');

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch {
      // silently fail
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch('/api/users');
        if (!res.ok) return;
        const users = await res.json();
        if (Array.isArray(users) && users.length > 0) {
          const members: TeamMember[] = users.map((u: { display_name?: string | null; email?: string }) => {
            const name = u.display_name || u.email?.split('@')[0] || 'Unknown';
            return { name, initials: getInitials(name) };
          });
          members.push({ name: 'Unassigned', initials: '' });
          setTeamMembers(members);
        }
      } catch {
        // keep fallback
      }
    }
    fetchUsers();
  }, []);

  function getColumnTasks(status: string) {
    return tasks
      .filter(t => t.status === status)
      .sort((a, b) => a.position - b.position);
  }

  async function createTask() {
    if (!newTitle.trim()) return;
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle,
        description: newDescription || null,
        label: newLabel,
        assigned_to: teamMembers.find(m => m.initials === newAssignee)?.name || null,
        assigned_to_initials: newAssignee || null,
        due_date: newDueDate || null,
      }),
    });
    setNewTitle('');
    setNewDescription('');
    setNewLabel('content');
    setNewAssignee('MC');
    setNewDueDate('');
    setShowModal(false);
    fetchTasks();
  }

  async function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    fetchTasks();
  }

  // --- Drag & Drop ---
  function handleDragStart(e: React.DragEvent, taskId: string, status: string) {
    draggedTaskRef.current = taskId;
    dragSourceColumnRef.current = status;
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    requestAnimationFrame(() => {
      (e.target as HTMLElement).style.opacity = '0.4';
    });
  }

  function handleDragEnd(e: React.DragEvent) {
    (e.target as HTMLElement).style.opacity = '1';
    setDragOverColumn(null);
    setDragOverIndex(null);
    draggedTaskRef.current = null;
    dragSourceColumnRef.current = null;
  }

  function handleColumnDragOver(e: React.DragEvent, columnKey: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnKey);
  }

  function handleCardDragOver(e: React.DragEvent, columnKey: string, index: number) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnKey);
    setDragOverIndex(index);
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear if leaving the column entirely
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !(e.currentTarget as HTMLElement).contains(relatedTarget)) {
      setDragOverColumn(null);
      setDragOverIndex(null);
    }
  }

  async function handleDrop(e: React.DragEvent, targetColumn: string) {
    e.preventDefault();
    setDragOverColumn(null);
    const dropIndex = dragOverIndex;
    setDragOverIndex(null);

    const taskId = draggedTaskRef.current;
    if (!taskId) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Build the new column order
    const columnTasks = getColumnTasks(targetColumn).filter(t => t.id !== taskId);

    // Insert at drop position or end
    const insertIndex = dropIndex !== null ? Math.min(dropIndex, columnTasks.length) : columnTasks.length;
    columnTasks.splice(insertIndex, 0, { ...task, status: targetColumn });

    // Optimistic update
    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        return { ...t, status: targetColumn, position: insertIndex };
      }
      return t;
    });
    setTasks(updatedTasks);

    // Build reorder payload for the target column
    const reorderPayload = columnTasks.map((t, i) => ({
      id: t.id,
      status: targetColumn,
      position: i,
    }));

    // If moved from a different column, also reorder the source column
    if (dragSourceColumnRef.current && dragSourceColumnRef.current !== targetColumn) {
      const sourceTasks = getColumnTasks(dragSourceColumnRef.current).filter(t => t.id !== taskId);
      sourceTasks.forEach((t, i) => {
        reorderPayload.push({ id: t.id, status: dragSourceColumnRef.current!, position: i });
      });
    }

    await fetch('/api/tasks/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: reorderPayload }),
    });

    fetchTasks();
  }

  function formatDueDate(dateStr: string) {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((date.getTime() - today.getTime()) / 86400000);

    if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, color: 'var(--red)' };
    if (diffDays === 0) return { text: 'Today', color: 'var(--amber)' };
    if (diffDays === 1) return { text: 'Tomorrow', color: 'var(--amber)' };
    return {
      text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      color: 'var(--text-secondary)',
    };
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[2.4rem] tracking-[1.5px]">Tasks</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              setRefreshing(true);
              await fetchTasks();
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
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-lg bg-accent text-white text-[.82rem] font-semibold hover:bg-[var(--accent-hover)] transition-colors"
          >
            + New Task
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <p className="text-center text-muted text-sm py-12">Loading tasks...</p>
      ) : (
        <div className="grid grid-cols-4 gap-4" style={{ minHeight: '70vh' }}>
          {COLUMNS.map(col => {
            const colTasks = getColumnTasks(col.key);
            const isDragOver = dragOverColumn === col.key;
            return (
              <div
                key={col.key}
                className="flex flex-col rounded-card border border-border bg-card/40 backdrop-blur-sm transition-colors duration-150"
                style={isDragOver ? { borderColor: col.accent, background: `${col.accent}08` } : undefined}
                onDragOver={(e) => handleColumnDragOver(e, col.key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.key)}
              >
                {/* Column Header */}
                <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-border">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.accent }} />
                  <span className="text-[.78rem] font-bold uppercase tracking-wider text-cream">{col.label}</span>
                  <span
                    className="text-[.65rem] px-2 py-0.5 rounded-full font-semibold ml-auto"
                    style={{ background: `${col.accent}20`, color: col.accent }}
                  >
                    {colTasks.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 p-2.5 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 52px)' }}>
                  {colTasks.map((task, index) => {
                    const labelStyle = LABELS[task.label] || LABELS.content;
                    const due = task.due_date ? formatDueDate(task.due_date) : null;
                    const showDropIndicator = isDragOver && dragOverIndex === index;

                    return (
                      <div key={task.id}>
                        {showDropIndicator && (
                          <div className="h-0.5 rounded-full mx-1 mb-1.5" style={{ background: col.accent, opacity: 0.6 }} />
                        )}
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id, col.key)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleCardDragOver(e, col.key, index)}
                          className="group rounded-xl border border-border bg-[var(--surface)] p-3.5 cursor-grab active:cursor-grabbing hover:border-[var(--border-hover)] transition-all"
                        >
                          {/* Label + Delete */}
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className="text-[.6rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                              style={{ background: labelStyle.bg, color: labelStyle.text }}
                            >
                              {labelStyle.label}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                              className="opacity-0 group-hover:opacity-100 text-muted hover:text-[var(--red)] text-sm transition-all leading-none"
                            >
                              x
                            </button>
                          </div>

                          {/* Title */}
                          <p className="text-[.82rem] font-medium text-cream leading-snug mb-2">{task.title}</p>

                          {/* Description preview */}
                          {task.description && (
                            <p className="text-[.7rem] text-[var(--text-secondary)] leading-relaxed mb-2.5 line-clamp-2">
                              {task.description}
                            </p>
                          )}

                          {/* Footer: assignee + due date */}
                          <div className="flex items-center justify-between mt-1">
                            {task.assigned_to_initials ? (
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[.55rem] font-bold text-white"
                                style={{ background: getAvatarGradient(task.assigned_to_initials) }}
                                title={task.assigned_to || task.assigned_to_initials}
                              >
                                {task.assigned_to_initials}
                              </div>
                            ) : (
                              <div className="w-6 h-6" />
                            )}
                            {due && (
                              <span className="text-[.62rem] font-medium" style={{ color: due.color }}>
                                {due.text}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Drop indicator at the end */}
                  {isDragOver && (dragOverIndex === null || dragOverIndex >= colTasks.length) && (
                    <div className="h-0.5 rounded-full mx-1" style={{ background: col.accent, opacity: 0.6 }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Task Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md rounded-card border border-border bg-[var(--surface)] p-6 animate-fade-in-scale"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-heading text-[1.3rem] tracking-[1px] mb-5">New Task</h2>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-[.7rem] uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">Title</label>
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') createTask(); }}
                  placeholder="What needs to be done?"
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-cream text-[.85rem] outline-none focus:border-accent transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[.7rem] uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Add details (optional)"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-cream text-[.85rem] outline-none focus:border-accent transition-colors resize-none"
                />
              </div>

              {/* Label + Assignee row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[.7rem] uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">Label</label>
                  <select
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-cream text-[.82rem] outline-none focus:border-accent transition-colors"
                  >
                    <option value="content">Content</option>
                    <option value="dev">Dev</option>
                    <option value="design">Design</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[.7rem] uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">Assign To</label>
                  <select
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-cream text-[.82rem] outline-none focus:border-accent transition-colors"
                  >
                    {teamMembers.map(m => (
                      <option key={m.initials || '_unassigned'} value={m.initials}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-[.7rem] uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">Due Date</label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-cream text-[.82rem] outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-[.82rem] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-cream transition-all"
              >
                Cancel
              </button>
              <button
                onClick={createTask}
                disabled={!newTitle.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-white text-[.82rem] font-semibold hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
