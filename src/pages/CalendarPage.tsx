import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Calendar, Clock, Plus, Trash2, Bell, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Reminder {
  id: string;
  title: string;
  body: string | null;
  agent: string | null;
  priority: string;
  status: string;
  metadata: any;
  created_at: string | null;
  read_at: string | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-900/40 text-red-300 border-red-700/40',
  high:   'bg-orange-900/40 text-orange-300 border-orange-700/40',
  normal: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
  low:    'bg-gray-800/40 text-gray-400 border-gray-700/40',
};

// Upcoming events from cron schedules (static + dynamic)
const SCHEDULED_EVENTS = [
  { time: '07:00', label: 'Video Scripts',      agent: 'Video Bot',     recurrence: 'Daily', color: 'text-purple-400' },
  { time: '08:00', label: 'Discord Engagement', agent: 'Alex Claww',    recurrence: 'Daily', color: 'text-cyan-400' },
  { time: '08:30', label: 'Meeting: Adriaan',    agent: 'Reminder',      recurrence: 'Feb 20', color: 'text-yellow-400' },
  { time: '09:00', label: 'Cold Outreach',       agent: 'Alex Outreach', recurrence: 'Mon-Fri', color: 'text-orange-400' },
  { time: '09:00', label: 'Repo Sync',           agent: 'Repo Watcher',  recurrence: 'Daily', color: 'text-blue-400' },
  { time: '12:00', label: 'Daily Heartbeat',    agent: 'Heartbeat',     recurrence: 'Daily', color: 'text-green-400' },
  { time: '18:00', label: 'Memory Curation',    agent: 'Memory Bot',    recurrence: 'Sundays', color: 'text-yellow-400' },
];

export default function CalendarPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', priority: 'normal', due: '' });

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    fetchReminders();
    const channel = supabase
      .channel('reminders_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchReminders)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchReminders = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('type', 'reminder')
      .neq('status', 'dismissed')
      .order('created_at', { ascending: false });
    if (!error) setReminders((data as Reminder[]) || []);
    setLoading(false);
  };

  const createReminder = async () => {
    if (!form.title.trim()) { toast.error('Title required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('notifications').insert({
        type: 'reminder',
        title: form.title.trim(),
        body: form.body.trim() || null,
        agent: 'Josh',
        priority: form.priority,
        status: 'unread',
        metadata: form.due ? { due: form.due } : null,
      });
      if (error) throw error;
      setForm({ title: '', body: '', priority: 'normal', due: '' });
      setShowForm(false);
      toast.success('Reminder set');
    } catch { toast.error('Failed to create reminder'); }
    finally { setSaving(false); }
  };

  const dismissReminder = async (id: string) => {
    await supabase.from('notifications').update({ status: 'dismissed' }).eq('id', id);
    toast.info('Dismissed');
  };

  const timeSince = (ts: string | null) => {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <div className="space-y-4 pb-24 sm:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-wider text-foreground glow-cyan flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Calendar
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">{dateStr} · {timeStr}</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="h-9 w-9 sm:w-auto sm:px-4 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 font-mono text-xs rounded-full sm:rounded-md"
        >
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Reminder</span>
        </Button>
      </div>

      {/* Add reminder form */}
      {showForm && (
        <Card className="border-primary/40 bg-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs text-primary uppercase tracking-wider">New Reminder</p>
              <button onClick={() => setShowForm(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <Input placeholder="Reminder title..." value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="bg-secondary/30 border-border/50 font-mono text-sm h-10"
              onKeyDown={e => e.key === 'Enter' && createReminder()} />
            <textarea placeholder="Notes (optional)" value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              className="w-full bg-secondary/30 border border-border/50 rounded-md p-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground resize-none h-14 focus:outline-none focus:border-primary/50" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Priority</p>
                <div className="flex gap-1">
                  {['urgent', 'high', 'normal', 'low'].map(p => (
                    <button key={p} onClick={() => setForm(f => ({ ...f, priority: p }))}
                      className={cn('font-mono text-[9px] px-2 py-1 rounded border transition-colors',
                        form.priority === p ? PRIORITY_COLORS[p] : 'border-border/40 text-muted-foreground')}>
                      {p.charAt(0).toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Due (optional)</p>
                <Input type="datetime-local" value={form.due}
                  onChange={e => setForm(f => ({ ...f, due: e.target.value }))}
                  className="bg-secondary/30 border-border/50 font-mono text-[10px] h-8" />
              </div>
            </div>
            <Button onClick={createReminder} disabled={saving || !form.title.trim()}
              className="w-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 font-mono text-xs h-9">
              {saving ? 'Setting...' : 'Set Reminder'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Automation Schedule */}
      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display tracking-wide flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Automation Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {SCHEDULED_EVENTS.map((event, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded hover:bg-secondary/20 transition-colors">
                <span className="font-mono text-[10px] text-muted-foreground w-10 shrink-0">{event.time}</span>
                <ChevronRight className={cn('h-3 w-3 shrink-0', event.color)} />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs text-foreground">{event.label}</p>
                  <p className="font-mono text-[9px] text-muted-foreground">{event.agent}</p>
                </div>
                <span className="font-mono text-[9px] text-muted-foreground shrink-0">{event.recurrence}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reminders */}
      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display tracking-wide flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Reminders
            {reminders.filter(r => r.status === 'unread').length > 0 && (
              <span className="bg-primary text-black font-mono text-[9px] px-1.5 py-0.5 rounded-full">
                {reminders.filter(r => r.status === 'unread').length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="font-mono text-xs text-muted-foreground animate-pulse py-4 text-center">Loading...</div>
          ) : reminders.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground text-center py-6">No reminders set</p>
          ) : (
            <div className="space-y-2">
              {reminders.map(r => (
                <div key={r.id} className="flex items-start gap-3 p-2.5 rounded border border-border/30 bg-secondary/10">
                  <div className={cn('h-2 w-2 rounded-full mt-1.5 shrink-0',
                    r.priority === 'urgent' ? 'bg-red-400' : r.priority === 'high' ? 'bg-orange-400' : 'bg-blue-400/50')} />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-foreground">{r.title}</p>
                    {r.body && <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{r.body}</p>}
                    {r.metadata?.due && (
                      <p className="font-mono text-[9px] text-warning mt-0.5">
                        Due: {new Date(r.metadata.due).toLocaleString()}
                      </p>
                    )}
                    <p className="font-mono text-[9px] text-muted-foreground/60 mt-0.5">{timeSince(r.created_at)}</p>
                  </div>
                  <button onClick={() => dismissReminder(r.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
