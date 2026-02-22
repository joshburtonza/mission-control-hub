import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ListTodo, Zap, CheckCircle2, XCircle, Clock, Loader2, RefreshCw, Plus, X, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TaskItem {
  id: string;
  agent: string | null;
  task_type: string | null;
  status: string | null;
  payload: any;
  result: any;
  created_at: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  retry_count?: number | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  queued:    { label: 'Queued',    color: 'bg-warning/20 text-warning border-warning/30',             icon: <Clock className="h-3 w-3" /> },
  executing: { label: 'Running',   color: 'bg-primary/20 text-primary border-primary/30',             icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  completed: { label: 'Completed', color: 'bg-success/20 text-success border-success/30',             icon: <CheckCircle2 className="h-3 w-3" /> },
  failed:    { label: 'Failed',    color: 'bg-destructive/20 text-destructive border-destructive/30', icon: <XCircle className="h-3 w-3" /> },
  skipped:   { label: 'Skipped',   color: 'bg-muted/20 text-muted-foreground border-muted/30',        icon: <XCircle className="h-3 w-3" /> },
};

const taskTypeLabels: Record<string, string> = {
  email_send:       'Email Send',
  email_analysis:   'Email Analysis',
  terminal_command: 'Terminal Command',
  cron_job:         'Cron Job',
  reminder:         'Reminder',
  task_execution:   'Task Execution',
};

const columns: Array<{ key: string; label: string; icon: React.ReactNode }> = [
  { key: 'queued',    label: 'Queued',    icon: <Clock className="h-4 w-4 text-warning" /> },
  { key: 'executing', label: 'Running',   icon: <Loader2 className="h-4 w-4 text-primary animate-spin" /> },
  { key: 'completed', label: 'Completed', icon: <CheckCircle2 className="h-4 w-4 text-success" /> },
  { key: 'failed',    label: 'Failed',    icon: <XCircle className="h-4 w-4 text-destructive" /> },
];

export default function Tasks() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', prompt: '' });

  useEffect(() => {
    fetchTasks();
    const channel = supabase
      .channel('task_queue_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_queue' }, fetchTasks)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('task_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error) setTasks(data || []);
    setLoading(false);
  };

  const submitTask = async () => {
    if (!form.title.trim()) { toast.error('Task title required'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('task_queue').insert({
        agent: 'Claude Code',
        task_type: 'task_execution',
        status: 'queued',
        payload: {
          title: form.title.trim(),
          prompt: form.prompt.trim() || form.title.trim(),
        },
      });
      if (error) throw error;
      setForm({ title: '', prompt: '' });
      setShowForm(false);
      toast.success('Task queued — Claude will pick it up within 60s');
    } catch (e: any) {
      toast.error('Failed to queue task');
    } finally {
      setSubmitting(false);
    }
  };

  const byStatus = (status: string) => tasks.filter(t => t.status === status);

  return (
    <div className="space-y-6">
      {/* Header with New Task button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Task Queue</h2>
          <p className="text-[10px] text-card-foreground/30 mt-0.5">
            {byStatus('queued').length} queued · {byStatus('executing').length} running
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
            showForm
              ? 'bg-white/10 text-card-foreground'
              : 'bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30'
          )}
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? 'Cancel' : 'Queue Task'}
        </button>
      </div>

      {/* New Task Form */}
      {showForm && (
        <div className="rounded-2xl bg-card p-5 ring-1 ring-primary/30">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-card-foreground">New Task for Claude Code</span>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-card-foreground/40 uppercase tracking-wider mb-1.5">Title</p>
              <input
                type="text"
                placeholder="e.g. Summarise this week's outreach performance"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-card-foreground placeholder:text-card-foreground/20 focus:outline-none focus:border-primary/50"
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitTask()}
              />
            </div>
            <div>
              <p className="text-[10px] text-card-foreground/40 uppercase tracking-wider mb-1.5">
                Instructions <span className="normal-case text-card-foreground/20">(optional — defaults to title)</span>
              </p>
              <textarea
                placeholder="More detail about what you want done..."
                value={form.prompt}
                onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-card-foreground placeholder:text-card-foreground/20 focus:outline-none focus:border-primary/50 resize-none"
              />
            </div>
            <button
              onClick={submitTask}
              disabled={submitting || !form.title.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-xl text-xs font-medium transition-all disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? 'Queuing...' : 'Queue for Claude'}
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2 md:gap-3">
        {[
          { label: 'Queued',    value: byStatus('queued').length,    color: 'text-warning' },
          { label: 'Running',   value: byStatus('executing').length, color: 'text-primary' },
          { label: 'Completed', value: byStatus('completed').length, color: 'text-success' },
          { label: 'Failed',    value: byStatus('failed').length,    color: 'text-destructive' },
          { label: 'Total',     value: tasks.length,                 color: 'text-card-foreground' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl bg-card px-4 py-3">
            <p className="text-[10px] text-card-foreground/40 uppercase tracking-wider">{stat.label}</p>
            <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground animate-pulse">Loading tasks...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
          {columns.map(col => {
            const colTasks = byStatus(col.key);
            const sc = statusConfig[col.key];
            return (
              <div key={col.key} className="rounded-2xl bg-card overflow-hidden">
                <div className="p-4 flex items-center justify-between border-b border-white/5">
                  <div className="flex items-center gap-2">
                    {col.icon}
                    <span className="text-xs font-semibold text-card-foreground tracking-wide">{col.label}</span>
                  </div>
                  <Badge className={cn('text-[9px] border rounded-lg', sc.color)}>{colTasks.length}</Badge>
                </div>
                <div className="p-2 space-y-1.5 max-h-80 overflow-auto dark-scrollbar">
                  {colTasks.length === 0 ? (
                    <p className="text-[10px] text-card-foreground/30 text-center py-8">Empty</p>
                  ) : (
                    colTasks.map(task => (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                        className={cn(
                          'p-3 rounded-xl cursor-pointer transition-all',
                          selectedTask?.id === task.id
                            ? 'bg-white/10 ring-1 ring-primary/40'
                            : 'hover:bg-white/5'
                        )}
                      >
                        <p className="text-xs text-card-foreground/80 truncate">
                          {task.payload?.title || taskTypeLabels[task.task_type || ''] || task.task_type}
                        </p>
                        <p className="text-[10px] text-card-foreground/30 truncate mt-0.5">
                          {task.agent || 'Unknown'}
                        </p>
                        <p className="text-[9px] text-card-foreground/20 mt-1">
                          {task.created_at ? new Date(task.created_at).toLocaleString() : ''}
                        </p>
                        {task.retry_count != null && task.retry_count > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <RefreshCw className="h-2.5 w-2.5 text-warning" />
                            <span className="text-[9px] text-warning">Retry #{task.retry_count}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task detail */}
      {selectedTask && (
        <div className="rounded-2xl bg-card p-5 ring-1 ring-primary/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-card-foreground">
                {selectedTask.payload?.title || 'Task Detail'}
              </h3>
            </div>
            <button onClick={() => setSelectedTask(null)} className="text-card-foreground/30 hover:text-card-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Type',    value: taskTypeLabels[selectedTask.task_type || ''] || selectedTask.task_type },
              { label: 'Agent',   value: selectedTask.agent },
              { label: 'Status',  value: selectedTask.status },
              { label: 'Retries', value: String(selectedTask.retry_count ?? 0) },
            ].map(item => (
              <div key={item.label}>
                <p className="text-[10px] text-card-foreground/40 uppercase tracking-wider">{item.label}</p>
                <p className="text-xs text-card-foreground mt-0.5">{item.value || '—'}</p>
              </div>
            ))}
          </div>

          {/* Prompt */}
          {selectedTask.payload?.prompt && (
            <div className="mb-3">
              <p className="text-[10px] text-card-foreground/40 uppercase tracking-wider mb-1">Prompt</p>
              <p className="text-xs text-card-foreground/70 bg-white/5 p-3 rounded-xl leading-relaxed">
                {selectedTask.payload.prompt}
              </p>
            </div>
          )}

          {/* Claude's output — human readable */}
          {selectedTask.result?.output && (
            <div>
              <p className="text-[10px] text-success/60 uppercase tracking-wider mb-1">Claude's Response</p>
              <div className="text-xs text-card-foreground/80 bg-success/5 border border-success/10 p-3 rounded-xl leading-relaxed whitespace-pre-wrap max-h-64 overflow-auto dark-scrollbar">
                {selectedTask.result.output}
              </div>
              {selectedTask.completed_at && (
                <p className="text-[9px] text-card-foreground/20 mt-1.5">
                  Completed {new Date(selectedTask.completed_at).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Error output */}
          {selectedTask.result?.error && (
            <div>
              <p className="text-[10px] text-destructive/60 uppercase tracking-wider mb-1">Error</p>
              <p className="text-xs text-destructive/80 bg-destructive/5 border border-destructive/10 p-3 rounded-xl">
                {selectedTask.result.error}
              </p>
            </div>
          )}

          {/* Raw payload for non-task_execution types */}
          {selectedTask.task_type !== 'task_execution' && selectedTask.payload && (
            <div className="mb-3">
              <p className="text-[10px] text-card-foreground/40 uppercase tracking-wider">Payload</p>
              <pre className="text-[10px] text-primary/80 bg-white/5 p-2 rounded-lg mt-0.5 max-h-20 overflow-auto dark-scrollbar">
                {JSON.stringify(selectedTask.payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
