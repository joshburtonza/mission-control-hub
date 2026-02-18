import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, CheckCircle2, Circle, Trash2, Clock, AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string | null;
}

const PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const;
const STATUSES = ['todo', 'in_progress', 'done', 'cancelled'] as const;

const priorityConfig: Record<string, { label: string; color: string; dot: string }> = {
  urgent: { label: 'Urgent',  color: 'bg-red-900/50 text-red-300 border-red-700/50',       dot: 'bg-red-400' },
  high:   { label: 'High',    color: 'bg-orange-900/50 text-orange-300 border-orange-700/50', dot: 'bg-orange-400' },
  normal: { label: 'Normal',  color: 'bg-blue-900/50 text-blue-300 border-blue-700/50',     dot: 'bg-blue-400' },
  low:    { label: 'Low',     color: 'bg-gray-800/50 text-gray-400 border-gray-700/50',     dot: 'bg-gray-500' },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  todo:       { label: 'To Do',       color: 'text-muted-foreground' },
  in_progress:{ label: 'In Progress', color: 'text-primary' },
  done:       { label: 'Done',        color: 'text-success' },
  cancelled:  { label: 'Cancelled',   color: 'text-destructive' },
};

const AGENTS = ['Josh', 'Alex Claww', 'Sophia CSM', 'Alex Outreach', 'Video Bot', 'Repo Watcher'];

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'normal',
    assigned_to: 'Josh',
    due_date: '',
  });

  useEffect(() => {
    fetchTasks();
    const channel = supabase
      .channel('tasks_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setTasks((data as Task[]) || []);
    setLoading(false);
  };

  const createTask = async () => {
    if (!form.title.trim()) { toast.error('Title required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('tasks').insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        assigned_to: form.assigned_to,
        due_date: form.due_date || null,
        status: 'todo',
      });
      if (error) throw error;
      setForm({ title: '', description: '', priority: 'normal', assigned_to: 'Josh', due_date: '' });
      setShowForm(false);
      toast.success('Task created');
    } catch { toast.error('Failed to create task'); }
    finally { setSaving(false); }
  };

  const updateStatus = async (task: Task, newStatus: string) => {
    const update: any = { status: newStatus };
    if (newStatus === 'done') update.completed_at = new Date().toISOString();
    const { error } = await supabase.from('tasks').update(update).eq('id', task.id);
    if (error) toast.error('Failed to update task');
    else toast.success(newStatus === 'done' ? 'Task complete ✅' : 'Task updated');
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) toast.error('Failed to delete');
    else toast.success('Task deleted');
  };

  const timeSince = (ts: string | null) => {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };

  const filtered = tasks.filter(t => {
    const matchStatus = filterStatus === 'active'
      ? ['todo', 'in_progress'].includes(t.status)
      : filterStatus === 'all' ? true : t.status === filterStatus;
    const matchPriority = filterPriority === 'all' || t.priority === filterPriority;
    return matchStatus && matchPriority;
  });

  const counts = {
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    urgent: tasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length,
  };

  return (
    <div className="space-y-4 pb-24 sm:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-wider text-foreground glow-cyan">Tasks</h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            {counts.in_progress} running · {counts.todo} todo · {counts.done} done
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="h-9 w-9 sm:w-auto sm:px-4 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 font-mono text-xs rounded-full sm:rounded-md"
        >
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">New Task</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Urgent', value: counts.urgent, color: 'text-red-400', border: 'border-red-700/30' },
          { label: 'To Do',  value: counts.todo,   color: 'text-warning',  border: 'border-warning/30' },
          { label: 'Active', value: counts.in_progress, color: 'text-primary', border: 'border-primary/30' },
          { label: 'Done',   value: counts.done,   color: 'text-success',  border: 'border-success/30' },
        ].map(s => (
          <div key={s.label} className={`bg-card border ${s.border} rounded-md px-2 py-2`}>
            <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className={`font-display text-lg ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* New Task Form */}
      {showForm && (
        <Card className="border-primary/40 bg-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs text-primary uppercase tracking-wider">New Task</p>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <Input
              placeholder="Task title..."
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="bg-secondary/30 border-border/50 font-mono text-sm h-10"
              onKeyDown={e => e.key === 'Enter' && createTask()}
            />
            <textarea
              placeholder="Description (optional)"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full bg-secondary/30 border border-border/50 rounded-md p-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground resize-none h-16 focus:outline-none focus:border-primary/50"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Priority</p>
                <div className="flex gap-1 flex-wrap">
                  {PRIORITIES.map(p => (
                    <button
                      key={p}
                      onClick={() => setForm(f => ({ ...f, priority: p }))}
                      className={cn(
                        'font-mono text-[9px] px-2 py-1 rounded border transition-colors',
                        form.priority === p
                          ? priorityConfig[p].color
                          : 'border-border/40 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Assign To</p>
                <select
                  value={form.assigned_to}
                  onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                  className="w-full bg-secondary/30 border border-border/50 rounded-md px-2 py-1 font-mono text-xs text-foreground focus:outline-none focus:border-primary/50"
                >
                  {AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div>
              <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Due Date (optional)</p>
              <Input
                type="datetime-local"
                value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="bg-secondary/30 border-border/50 font-mono text-xs h-9"
              />
            </div>
            <Button
              onClick={createTask}
              disabled={saving || !form.title.trim()}
              className="w-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 font-mono text-xs h-9"
            >
              {saving ? 'Creating...' : 'Create Task'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-1">
          {[
            { key: 'active', label: 'Active' },
            { key: 'all', label: 'All' },
            { key: 'done', label: 'Done' },
            { key: 'cancelled', label: 'Cancelled' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className={cn(
                'font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded border transition-colors',
                filterStatus === f.key
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border/40 text-muted-foreground hover:text-primary'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {['all', ...PRIORITIES].map(p => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={cn(
                'font-mono text-[10px] px-2 py-1 rounded border transition-colors',
                filterPriority === p
                  ? p === 'all' ? 'border-primary/50 bg-primary/10 text-primary' : priorityConfig[p]?.color || ''
                  : 'border-border/40 text-muted-foreground hover:text-foreground'
              )}
            >
              {p === 'all' ? 'All' : p.charAt(0).toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="font-mono text-xs text-muted-foreground animate-pulse py-8 text-center">Loading tasks...</div>
      ) : filtered.length === 0 ? (
        <div className="border border-border/30 rounded-lg p-10 text-center">
          <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-3" />
          <p className="font-mono text-sm text-muted-foreground">
            {filterStatus === 'active' ? 'No active tasks — nothing pending' : 'No tasks match this filter'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => {
            const pc = priorityConfig[task.priority];
            const sc = statusConfig[task.status];
            const isExpanded = expandedId === task.id;
            const isDone = task.status === 'done';
            return (
              <div key={task.id} className={cn(
                'rounded-md border bg-card transition-all',
                isDone ? 'border-border/20 opacity-60' : 'border-border/40 hover:border-primary/30'
              )}>
                {/* Main row */}
                <div className="flex items-center gap-3 p-3">
                  {/* Status toggle */}
                  <button
                    onClick={() => updateStatus(task, isDone ? 'todo' : task.status === 'todo' ? 'in_progress' : 'done')}
                    className="shrink-0 text-muted-foreground hover:text-success transition-colors"
                  >
                    {isDone
                      ? <CheckCircle2 className="h-5 w-5 text-success" />
                      : task.status === 'in_progress'
                      ? <Circle className="h-5 w-5 text-primary" />
                      : <Circle className="h-5 w-5" />
                    }
                  </button>
                  {/* Priority dot */}
                  <div className={cn('h-2 w-2 rounded-full shrink-0', pc?.dot)} />
                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    <p className={cn('font-mono text-sm', isDone ? 'line-through text-muted-foreground' : 'text-foreground')}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {task.assigned_to && (
                        <span className="font-mono text-[9px] text-muted-foreground">{task.assigned_to}</span>
                      )}
                      {task.due_date && (
                        <span className="font-mono text-[9px] text-warning flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      )}
                      <span className="font-mono text-[9px] text-muted-foreground/60">{timeSince(task.created_at)}</span>
                    </div>
                  </div>
                  {/* Badges + actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge className={cn('text-[8px] font-mono border hidden sm:flex', pc?.color)}>{pc?.label}</Badge>
                    {task.status !== 'done' && task.status !== 'cancelled' && (
                      <button
                        onClick={() => updateStatus(task, task.status === 'todo' ? 'in_progress' : 'todo')}
                        className="font-mono text-[8px] px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground hover:text-primary hidden sm:block"
                      >
                        {task.status === 'todo' ? 'Start' : 'Pause'}
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : task.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-3 pt-0 border-t border-border/20 space-y-2">
                    {task.description && (
                      <p className="font-mono text-xs text-foreground/70 mt-2">{task.description}</p>
                    )}
                    <div className="flex gap-2 flex-wrap mt-2">
                      {task.status !== 'done' && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus(task, 'done')}
                          className="h-7 text-[10px] font-mono bg-success/10 hover:bg-success/20 text-success border border-success/30"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Done
                        </Button>
                      )}
                      {task.status === 'todo' && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus(task, 'in_progress')}
                          className="h-7 text-[10px] font-mono bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30"
                        >
                          Start Task
                        </Button>
                      )}
                      {task.status !== 'cancelled' && task.status !== 'done' && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus(task, 'cancelled')}
                          className="h-7 text-[10px] font-mono bg-secondary/30 hover:bg-secondary/50 text-muted-foreground border border-border/40"
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => deleteTask(task.id)}
                        className="h-7 text-[10px] font-mono bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 ml-auto"
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Urgent warning */}
      {counts.urgent > 0 && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 bg-red-900/90 text-red-200 border border-red-700/50 rounded-full px-3 py-1.5 font-mono text-xs flex items-center gap-1.5 shadow-lg">
          <AlertTriangle className="h-3.5 w-3.5" />
          {counts.urgent} urgent
        </div>
      )}
    </div>
  );
}
