import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import TetrisLoading from '@/components/ui/tetris-loader';
import { Plus, X, RefreshCw, CheckCircle2, XCircle, Clock, Loader2, ChevronDown, ChevronUp, Tag, Send } from 'lucide-react';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  status: string;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface QueueItem {
  id: string;
  agent: string | null;
  task_type: string | null;
  status: string | null;
  payload: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  created_at: string | null;
  retry_count?: number | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const B = '#4B9EFF';

const card = {
  background: 'var(--s-card)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid var(--s-card-b)',
  borderRadius: '20px',
  boxShadow: 'var(--s-card-shadow)',
} as React.CSSProperties;

const STATUS_TABS = [
  { key: 'all',         label: 'All' },
  { key: 'todo',        label: 'Todo' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done',        label: 'Done' },
];

const QUEUE_COLS = [
  { key: 'queued',    label: 'Queued' },
  { key: 'executing', label: 'Running' },
  { key: 'completed', label: 'Done' },
  { key: 'failed',    label: 'Failed' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function relativeDue(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const absM = Math.abs(Math.floor(diff / 60000));
  const past = diff < 0;
  if (absM < 60) return past ? `${absM}m overdue` : `in ${absM}m`;
  const absH = Math.floor(absM / 60);
  if (absH < 24) return past ? `${absH}h overdue` : `in ${absH}h`;
  const absD = Math.floor(absH / 24);
  return past ? `${absD}d overdue` : `in ${absD}d`;
}

function priorityStyle(p: string | null): React.CSSProperties {
  if (p === 'high')   return { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' };
  if (p === 'low')    return { background: 'rgba(255,255,255,0.04)', color: 'var(--tc-30)', border: '1px solid rgba(255,255,255,0.08)' };
  return { background: 'rgba(255,255,255,0.07)', color: 'var(--tc-50)', border: '1px solid rgba(255,255,255,0.1)' };
}

function creatorStyle(name: string | null): React.CSSProperties {
  if (!name) return { background: 'rgba(255,255,255,0.07)', color: 'var(--tc-50)' };
  const lower = name.toLowerCase();
  if (lower.includes('bot') || lower.includes('agent') || lower.includes('ai')) {
    return { background: `${B}18`, color: B };
  }
  return { background: 'rgba(255,255,255,0.07)', color: 'var(--tc-50)' };
}

function extractTags(tasks: Task[]): string[] {
  const set = new Set<string>();
  tasks.forEach(t => (t.tags || []).forEach(tag => set.add(tag)));
  return Array.from(set).sort();
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Pill({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={style}
    >
      {children}
    </span>
  );
}

function TaskCard({
  task,
  onComplete,
}: {
  task: Task;
  onComplete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isDone = task.status === 'done';

  return (
    <div
      style={{
        ...card,
        opacity: isDone ? 0.55 : 1,
        transition: 'opacity 0.2s',
        borderRadius: '14px',
      }}
      className="overflow-hidden"
    >
      {/* Main row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left p-4 flex items-start gap-3 transition-colors"
        style={{ background: expanded ? `${B}08` : 'transparent' }}
        onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = 'var(--s-hover)'; }}
        onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        {/* Done icon */}
        <div className="mt-0.5 shrink-0">
          {isDone
            ? <CheckCircle2 className="h-4 w-4" style={{ color: B }} />
            : <div className="h-4 w-4 rounded-full border border-white/20" />
          }
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span
              className="text-sm font-semibold"
              style={{ color: isDone ? 'var(--tc-30)' : 'var(--tc-85)', textDecoration: isDone ? 'line-through' : 'none' }}
            >
              {task.title}
            </span>

            {/* Creator badge */}
            {task.created_by && (
              <Pill style={creatorStyle(task.created_by)}>
                {task.created_by}
              </Pill>
            )}

            {/* Priority badge */}
            {task.priority && task.priority !== 'normal' && (
              <Pill style={priorityStyle(task.priority)}>
                {task.priority}
              </Pill>
            )}
          </div>

          {/* Tags row */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {task.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--tc-30)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <Tag className="h-2 w-2" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Due date + created */}
          <div className="flex items-center gap-3">
            {task.due_date && (
              <span
                className="text-[10px]"
                style={{ color: new Date(task.due_date) < new Date() && !isDone ? '#f87171' : 'var(--tc-30)' }}
              >
                <Clock className="inline h-2.5 w-2.5 mr-0.5 mb-px" />
                {relativeDue(task.due_date)}
              </span>
            )}
            <span className="text-[10px]" style={{ color: 'var(--tc-30)' }}>
              {relativeTime(task.created_at)}
            </span>
          </div>
        </div>

        {/* Expand icon */}
        <div className="shrink-0 mt-0.5" style={{ color: 'var(--tc-30)' }}>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div
          className="px-4 pb-4 space-y-3 border-t"
          style={{ borderColor: 'var(--s-card-b)' }}
        >
          {task.description ? (
            <div className="mt-3 max-h-64 overflow-auto rounded-xl p-3 text-xs leading-relaxed whitespace-pre-wrap"
              style={{ background: 'var(--s-hover)', color: 'var(--tc-50)' }}
            >
              {task.description}
            </div>
          ) : (
            <p className="mt-3 text-[11px] italic" style={{ color: 'var(--tc-30)' }}>No description.</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {task.assigned_to && (
              <span className="text-[10px]" style={{ color: 'var(--tc-30)' }}>
                Assigned to: <span style={{ color: 'var(--tc-50)' }}>{task.assigned_to}</span>
              </span>
            )}
            {!isDone && (
              <button
                onClick={() => onComplete(task.id)}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                style={{ background: `${B}18`, color: B, border: `1px solid ${B}30` }}
              >
                <CheckCircle2 className="h-3 w-3" />
                Mark complete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Task Form ─────────────────────────────────────────────────────────────

interface AddTaskFormProps {
  onAdded: () => void;
  onCancel: () => void;
  creatorName: string;
}

function AddTaskForm({ onAdded, onCancel, creatorName }: AddTaskFormProps) {
  const [title, setTitle]         = useState('');
  const [priority, setPriority]   = useState('normal');
  const [assignedTo, setAssignedTo] = useState(creatorName);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title.trim()) { toast.error('Title required'); return; }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from('tasks').insert({
        title: title.trim(),
        priority,
        assigned_to: assignedTo.trim() || creatorName,
        status: 'todo',
        created_by: creatorName,
      });
      if (error) throw error;
      toast.success('Task added');
      onAdded();
    } catch (err) {
      console.error(err);
      toast.error('Failed to add task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="p-5 space-y-3"
      style={{ background: '#111', border: `1px solid ${B}30`, borderRadius: '20px' }}
    >
      <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--tc-30)' }}>New task</p>

      <input
        type="text"
        placeholder="Task title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submit()}
        className="w-full rounded-xl text-white text-sm px-3 py-2.5 focus:outline-none placeholder:text-white/20"
        style={{ background: 'var(--s-input)', border: '1px solid var(--s-input-b)' }}
        autoFocus
      />

      <div className="flex gap-3">
        <select
          value={priority}
          onChange={e => setPriority(e.target.value)}
          className="rounded-xl text-sm px-3 py-2.5 focus:outline-none"
          style={{ background: 'var(--s-input)', border: '1px solid var(--s-input-b)', color: 'var(--tc-85)' }}
        >
          <option value="low">Low priority</option>
          <option value="normal">Normal priority</option>
          <option value="high">High priority</option>
        </select>

        <input
          type="text"
          placeholder="Assigned to"
          value={assignedTo}
          onChange={e => setAssignedTo(e.target.value)}
          className="flex-1 rounded-xl text-sm px-3 py-2.5 focus:outline-none placeholder:text-white/20"
          style={{ background: 'var(--s-input)', border: '1px solid var(--s-input-b)', color: 'var(--tc-85)' }}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={submitting || !title.trim()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40"
          style={{ background: B, boxShadow: `0 0 14px ${B}50` }}
        >
          <Plus className="h-3.5 w-3.5" />
          {submitting ? 'Adding…' : 'Add Task'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--tc-50)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Claude Queue (collapsible) ─────────────────────────────────────────────

interface ClaudeQueueProps {
  queueItems: QueueItem[];
  onRefresh: () => void;
}

function ClaudeQueue({ queueItems, onRefresh }: ClaudeQueueProps) {
  const [open, setOpen] = useState(false);
  const [showQueueForm, setShowQueueForm] = useState(false);
  const [form, setForm] = useState({ title: '', prompt: '' });
  const [submitting, setSubmitting] = useState(false);

  const submitQueue = async () => {
    if (!form.title.trim()) { toast.error('Title required'); return; }
    setSubmitting(true);
    try {
      await (supabase as any).from('task_queue').insert({
        agent: 'Claude Code',
        task_type: 'task_execution',
        status: 'queued',
        payload: { title: form.title.trim(), prompt: form.prompt.trim() || form.title.trim() },
      });
      setForm({ title: '', prompt: '' });
      setShowQueueForm(false);
      toast.success('Queued — Claude picks it up within 60s');
      onRefresh();
    } catch {
      toast.error('Failed to queue');
    } finally {
      setSubmitting(false);
    }
  };

  const byStatus = (s: string) => queueItems.filter(t => t.status === s);

  return (
    <div style={card}>
      {/* Header toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 transition-colors"
        style={{ borderBottom: open ? '1px solid var(--s-card-b)' : 'none' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--s-hover)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <div className="flex items-center gap-2.5">
          <Loader2 className="h-4 w-4" style={{ color: 'var(--tc-30)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--tc-85)' }}>Claude Queue</span>
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'var(--tc-50)' }}
          >
            {queueItems.length}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4" style={{ color: 'var(--tc-30)' }} /> : <ChevronDown className="h-4 w-4" style={{ color: 'var(--tc-30)' }} />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Kanban columns */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {QUEUE_COLS.map(col => {
              const items = byStatus(col.key);
              return (
                <div key={col.key} className="rounded-xl overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="px-3 py-2 border-b flex items-center justify-between"
                    style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex items-center gap-1.5">
                      {col.key === 'queued'    && <Clock         className="h-3 w-3" style={{ color: 'var(--tc-30)' }} />}
                      {col.key === 'executing' && <Loader2       className="h-3 w-3 animate-spin" style={{ color: B }} />}
                      {col.key === 'completed' && <CheckCircle2  className="h-3 w-3" style={{ color: 'var(--tc-30)' }} />}
                      {col.key === 'failed'    && <XCircle       className="h-3 w-3" style={{ color: 'var(--tc-30)' }} />}
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--tc-50)' }}>{col.label}</span>
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--tc-30)' }}>{items.length}</span>
                  </div>
                  <div className="p-1.5 space-y-1 max-h-48 overflow-auto">
                    {items.length === 0 ? (
                      <p className="text-[10px] text-center py-6" style={{ color: 'var(--tc-30)' }}>Empty</p>
                    ) : items.map(item => (
                      <div key={item.id} className="p-2 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.04)' }}
                      >
                        <p className="text-[11px] truncate" style={{ color: 'var(--tc-85)' }}>
                          {(item.payload as any)?.title || item.task_type}
                        </p>
                        <p className="text-[9px] mt-0.5" style={{ color: 'var(--tc-30)' }}>
                          {item.agent} · {item.created_at ? relativeTime(item.created_at) : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* New queue task form */}
          {!showQueueForm ? (
            <button
              onClick={() => setShowQueueForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--tc-50)' }}
            >
              <Plus className="h-3 w-3" /> New Claude task
            </button>
          ) : (
            <div className="space-y-2 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <input
                type="text"
                placeholder="Task title"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitQueue()}
                className="w-full rounded-lg text-white text-xs px-3 py-2 focus:outline-none placeholder:text-white/20"
                style={{ background: 'var(--s-input)', border: '1px solid var(--s-input-b)' }}
                autoFocus
              />
              <textarea
                placeholder="Instructions (optional)"
                value={form.prompt}
                onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
                rows={2}
                className="w-full rounded-lg text-white text-xs px-3 py-2 focus:outline-none placeholder:text-white/20 resize-none"
                style={{ background: 'var(--s-input)', border: '1px solid var(--s-input-b)' }}
              />
              <div className="flex gap-2">
                <button
                  onClick={submitQueue}
                  disabled={submitting || !form.title.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold text-white disabled:opacity-40 transition-all"
                  style={{ background: B }}
                >
                  <Send className="h-3 w-3" />
                  {submitting ? 'Queuing…' : 'Queue'}
                </button>
                <button
                  onClick={() => { setShowQueueForm(false); setForm({ title: '', prompt: '' }); }}
                  className="px-3 py-2 rounded-lg text-[11px] font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--tc-50)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Tasks() {
  const { mcUser, isOwner } = useAuth();
  const creatorName = mcUser?.display_name ?? 'Josh';

  const [tasks, setTasks]           = useState<Task[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [tagFilter, setTagFilter]   = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchTasks = useCallback(async () => {
    let query = (supabase as any)
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!isOwner && creatorName) {
      query = query.eq('created_by', creatorName);
    }
    const { data, error } = await query;
    if (!error) setTasks((data as Task[]) || []);
  }, [isOwner, creatorName]);

  const fetchQueue = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from('task_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error) setQueueItems((data as QueueItem[]) || []);
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchTasks(), fetchQueue()]);
    setLoading(false);
  }, [fetchTasks, fetchQueue]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
    toast.success('Refreshed');
  };

  useEffect(() => {
    fetchAll();

    const ch = supabase.channel('tasks_page_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_queue' }, fetchQueue)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [fetchAll, fetchTasks, fetchQueue]);

  const markComplete = async (id: string) => {
    const now = new Date().toISOString();
    const { error } = await (supabase as any)
      .from('tasks')
      .update({ status: 'done', completed_at: now, updated_at: now })
      .eq('id', id);
    if (error) {
      toast.error('Failed to update task');
    } else {
      toast.success('Task marked complete');
      fetchTasks();
    }
  };

  // Derived
  const allTags = extractTags(tasks);

  const filtered = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (tagFilter.length > 0 && !tagFilter.every(tag => (t.tags || []).includes(tag))) return false;
    return true;
  });

  const counts = {
    all:         tasks.length,
    todo:        tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    done:        tasks.filter(t => t.status === 'done').length,
  };

  const toggleTag = (tag: string) => {
    setTagFilter(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold" style={{ color: 'var(--tc-85)' }}>Tasks</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--tc-30)' }}>
            {counts.todo} todo · {counts.in_progress} in progress · {counts.done} done
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--tc-50)' }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>

        <button
          onClick={() => setShowAddForm(f => !f)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shrink-0"
          style={showAddForm
            ? { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--tc-50)' }
            : { background: B, boxShadow: `0 0 14px ${B}50`, color: '#ffffff' }
          }
        >
          {showAddForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showAddForm ? 'Cancel' : 'Add Task'}
        </button>
      </div>

      {/* ── Add Task Form ── */}
      {showAddForm && (
        <AddTaskForm
          onAdded={() => { setShowAddForm(false); fetchTasks(); }}
          onCancel={() => setShowAddForm(false)}
          creatorName={creatorName}
        />
      )}

      {/* ── Status filter tabs ── */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_TABS.map(tab => {
          const active = statusFilter === tab.key;
          const count = counts[tab.key as keyof typeof counts];
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
              style={active
                ? { background: B, color: '#fff', boxShadow: `0 0 10px ${B}40` }
                : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--tc-50)' }
              }
            >
              {tab.label}
              <span
                className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                style={active
                  ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                  : { background: 'rgba(255,255,255,0.1)', color: 'var(--tc-30)' }
                }
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Tag filter pills ── */}
      {allTags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap items-center">
          <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--tc-30)' }}>Tags:</span>
          {allTags.map(tag => {
            const active = tagFilter.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                style={active
                  ? { background: `${B}20`, border: `1px solid ${B}50`, color: B }
                  : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--tc-30)' }
                }
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </button>
            );
          })}
          {tagFilter.length > 0 && (
            <button
              onClick={() => setTagFilter([])}
              className="px-2 py-1 rounded-lg text-[10px] transition-all"
              style={{ color: 'var(--tc-30)', background: 'rgba(255,255,255,0.04)' }}
            >
              clear
            </button>
          )}
        </div>
      )}

      {/* ── Task list ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <TetrisLoading size="sm" speed="fast" showLoadingText={false} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={card} className="p-12 text-center">
          <p className="text-sm" style={{ color: 'var(--tc-30)' }}>
            {tasks.length === 0 ? 'No tasks yet.' : 'No tasks match your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => (
            <TaskCard key={task.id} task={task} onComplete={markComplete} />
          ))}
        </div>
      )}

      {/* ── Claude Queue (collapsible, owner only) ── */}
      {isOwner && <ClaudeQueue queueItems={queueItems} onRefresh={fetchQueue} />}
    </div>
  );
}
