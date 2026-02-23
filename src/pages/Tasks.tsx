import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Send, Plus, X, RefreshCw, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TaskItem {
  id: string; agent: string | null; task_type: string | null; status: string | null;
  payload: any; result: any; created_at: string | null;
  started_at?: string | null; completed_at?: string | null; retry_count?: number | null;
}

const B = '#4B9EFF';
const card = { background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px' } as React.CSSProperties;

const cols = [
  { key: 'queued',    label: 'Queued' },
  { key: 'executing', label: 'Running' },
  { key: 'completed', label: 'Done' },
  { key: 'failed',    label: 'Failed' },
];

export default function Tasks() {
  const [tasks, setTasks]             = useState<TaskItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState<TaskItem | null>(null);
  const [showForm, setShowForm]       = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [form, setForm]               = useState({ title: '', prompt: '' });

  useEffect(() => {
    fetchTasks();
    const ch = supabase.channel('tasks_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_queue' }, fetchTasks)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchTasks = async () => {
    const { data, error } = await supabase.from('task_queue').select('*').order('created_at', { ascending: false }).limit(100);
    if (!error) setTasks(data || []);
    setLoading(false);
  };

  const submit = async () => {
    if (!form.title.trim()) { toast.error('Title required'); return; }
    setSubmitting(true);
    try {
      await supabase.from('task_queue').insert({ agent: 'Claude Code', task_type: 'task_execution', status: 'queued', payload: { title: form.title.trim(), prompt: form.prompt.trim() || form.title.trim() } });
      setForm({ title: '', prompt: '' }); setShowForm(false);
      toast.success('Queued — Claude picks it up within 60s');
    } catch { toast.error('Failed to queue'); }
    finally { setSubmitting(false); }
  };

  const by = (s: string) => tasks.filter(t => t.status === s);

  return (
    <div className="space-y-5">
      {/* Stats + new task button */}
      <div className="flex items-center gap-3">
        <div className="flex gap-3 flex-1 flex-wrap">
          {cols.map(c => {
            const n = by(c.key).length;
            const active = c.key === 'queued' || c.key === 'executing';
            return (
              <div key={c.key} style={card} className="px-4 py-3 min-w-[80px]">
                <p className="text-[10px] text-white/25 uppercase tracking-widest">{c.label}</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: active && n > 0 ? B : 'rgba(255,255,255,0.5)' }}>{n}</p>
              </div>
            );
          })}
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shrink-0"
          style={showForm
            ? { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }
            : { background: B, boxShadow: `0 0 14px ${B}50`, color: '#fff' }}>
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? 'Cancel' : 'New Task'}
        </button>
      </div>

      {/* New task form */}
      {showForm && (
        <div style={{ background: '#111', border: `1px solid ${B}30`, borderRadius: '20px' }} className="p-5 space-y-3">
          <p className="text-[10px] text-white/25 uppercase tracking-widest">Queue task for Claude</p>
          <input type="text" placeholder="Task title" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submit()}
            className="w-full rounded-xl text-white text-sm px-3 py-2.5 focus:outline-none placeholder:text-white/20"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }} />
          <textarea placeholder="Instructions (optional)" value={form.prompt}
            onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))} rows={3}
            className="w-full rounded-xl text-white text-sm px-3 py-2.5 focus:outline-none placeholder:text-white/20 resize-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }} />
          <button onClick={submit} disabled={submitting || !form.title.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40"
            style={{ background: B, boxShadow: `0 0 14px ${B}50` }}>
            <Send className="h-3.5 w-3.5" />{submitting ? 'Queuing…' : 'Queue for Claude'}
          </button>
        </div>
      )}

      {/* Kanban columns */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 rounded-full border-2 animate-spin" style={{ borderColor: B, borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {cols.map(col => {
            const colTasks = by(col.key);
            return (
              <div key={col.key} style={card} className="overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {col.key === 'queued'    && <Clock      className="h-3.5 w-3.5 text-white/30" />}
                    {col.key === 'executing' && <Loader2    className="h-3.5 w-3.5 animate-spin" style={{ color: B }} />}
                    {col.key === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 text-white/30" />}
                    {col.key === 'failed'    && <XCircle    className="h-3.5 w-3.5 text-white/20" />}
                    <span className="text-xs font-semibold text-white/60">{col.label}</span>
                  </div>
                  <span className="text-[10px] text-white/25">{colTasks.length}</span>
                </div>
                <div className="p-2 space-y-1 max-h-72 overflow-auto">
                  {colTasks.length === 0 ? (
                    <p className="text-[10px] text-white/15 text-center py-8">Empty</p>
                  ) : (
                    colTasks.map(task => (
                      <button key={task.id} onClick={() => setSelected(selected?.id === task.id ? null : task)}
                        className="w-full text-left p-3 rounded-xl transition-all"
                        style={{ background: selected?.id === task.id ? `${B}10` : 'transparent', border: selected?.id === task.id ? `1px solid ${B}30` : '1px solid transparent' }}
                        onMouseEnter={e => { if (selected?.id !== task.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                        onMouseLeave={e => { if (selected?.id !== task.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <p className="text-xs text-white/70 truncate">{task.payload?.title || task.task_type}</p>
                        <p className="text-[10px] text-white/25 mt-0.5">{task.agent}</p>
                        <p className="text-[9px] text-white/15 mt-0.5">{task.created_at ? new Date(task.created_at).toLocaleString() : ''}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task detail */}
      {selected && (
        <div style={{ background: '#111', border: `1px solid ${B}25`, borderRadius: '20px' }} className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">{selected.payload?.title || 'Task Detail'}</p>
            <button onClick={() => setSelected(null)} className="text-white/25 hover:text-white/50"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[['Type', selected.task_type],['Agent', selected.agent],['Status', selected.status],['Retries', String(selected.retry_count ?? 0)]].map(([l, v]) => (
              <div key={l}>
                <p className="text-[10px] text-white/25 uppercase tracking-widest">{l}</p>
                <p className="text-xs text-white/60 mt-0.5">{v || '—'}</p>
              </div>
            ))}
          </div>
          {selected.payload?.prompt && (
            <div>
              <p className="text-[10px] text-white/25 uppercase tracking-widest mb-1.5">Prompt</p>
              <p className="text-xs text-white/50 rounded-xl p-3 leading-relaxed" style={{ background: 'rgba(255,255,255,0.04)' }}>{selected.payload.prompt}</p>
            </div>
          )}
          {selected.result?.output && (
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: `${B}80` }}>Claude's Response</p>
              <div className="text-xs text-white/70 rounded-xl p-3 leading-relaxed whitespace-pre-wrap max-h-64 overflow-auto"
                style={{ background: `${B}08`, border: `1px solid ${B}20` }}>
                {selected.result.output}
              </div>
            </div>
          )}
          {selected.result?.error && (
            <div>
              <p className="text-[10px] text-white/25 uppercase tracking-widest mb-1.5">Error</p>
              <p className="text-xs text-white/40 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>{selected.result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
