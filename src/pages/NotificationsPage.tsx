import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Bell, Mail, AlertTriangle, CheckCircle2, Activity, GitBranch, Zap, Send, BellOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  agent: string | null;
  priority: string;
  status: string;
  metadata: any;
  created_at: string | null;
  read_at: string | null;
}

const typeConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  email_inbound: { icon: <Mail className="h-3.5 w-3.5" />,       color: 'text-cyan-400 bg-cyan-900/30 border-cyan-700/40',     label: 'Email In' },
  email_sent:    { icon: <Send className="h-3.5 w-3.5" />,       color: 'text-green-400 bg-green-900/30 border-green-700/40',   label: 'Email Sent' },
  escalation:    { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'text-orange-400 bg-orange-900/30 border-orange-700/40', label: 'Escalation' },
  approval:      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/40', label: 'Approval' },
  heartbeat:     { icon: <Activity className="h-3.5 w-3.5" />,   color: 'text-primary bg-primary/10 border-primary/30',        label: 'Heartbeat' },
  outreach:      { icon: <Zap className="h-3.5 w-3.5" />,        color: 'text-purple-400 bg-purple-900/30 border-purple-700/40', label: 'Outreach' },
  repo:          { icon: <GitBranch className="h-3.5 w-3.5" />,  color: 'text-blue-400 bg-blue-900/30 border-blue-700/40',     label: 'Repo' },
  system:        { icon: <Activity className="h-3.5 w-3.5" />,   color: 'text-gray-400 bg-gray-800/30 border-gray-700/40',     label: 'System' },
  reminder:      { icon: <Bell className="h-3.5 w-3.5" />,       color: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/40', label: 'Reminder' },
};

const priorityDot: Record<string, string> = {
  urgent: 'bg-red-400',
  high:   'bg-orange-400',
  normal: 'bg-blue-400/0',
  low:    'bg-gray-500/0',
};

const FILTER_TYPES = ['all', 'email_inbound', 'escalation', 'approval', 'heartbeat', 'outreach', 'repo', 'system'];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'unread' | 'all'>('unread');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchNotifications();
    const channel = supabase
      .channel('notifications_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchNotifications)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .neq('status', 'dismissed')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error) setNotifications((data as Notification[]) || []);
    setLoading(false);
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ status: 'read', read_at: new Date().toISOString() }).eq('id', id);
  };

  const dismiss = async (id: string) => {
    await supabase.from('notifications').update({ status: 'dismissed' }).eq('id', id);
    toast.info('Dismissed');
  };

  const markAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('status', 'unread');
    toast.success('All marked as read');
  };

  const handleExpand = (id: string, currentStatus: string) => {
    setExpanded(expanded === id ? null : id);
    if (currentStatus === 'unread') markRead(id);
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

  const filtered = notifications.filter(n => {
    const matchType = filterType === 'all' || n.type === filterType;
    const matchStatus = filterStatus === 'all' || n.status === 'unread';
    return matchType && matchStatus;
  });

  const unreadCount = notifications.filter(n => n.status === 'unread').length;
  const urgentCount = notifications.filter(n => n.priority === 'urgent' && n.status === 'unread').length;

  return (
    <div className="space-y-4 pb-24 sm:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-wider text-foreground glow-cyan flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notifications
            {unreadCount > 0 && (
              <span className="bg-primary text-black font-mono text-[10px] px-1.5 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            {unreadCount} unread{urgentCount > 0 ? ` · ${urgentCount} urgent` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchNotifications}
            className="h-7 w-7 p-0 border-border/40 text-muted-foreground hover:text-primary">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          {unreadCount > 0 && (
            <Button size="sm" onClick={markAllRead}
              className="h-7 text-[10px] font-mono bg-secondary/30 hover:bg-secondary/50 text-muted-foreground border border-border/40">
              <CheckCircle2 className="h-3 w-3 mr-1" />Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Unread',    value: unreadCount, color: 'text-primary', border: 'border-primary/30' },
          { label: 'Urgent',    value: urgentCount, color: 'text-red-400', border: 'border-red-700/30' },
          { label: 'Escalation', value: notifications.filter(n => n.type === 'escalation' && n.status === 'unread').length, color: 'text-orange-400', border: 'border-orange-700/30' },
          { label: 'Total',     value: notifications.length, color: 'text-muted-foreground', border: 'border-border/30' },
        ].map(s => (
          <div key={s.label} className={`bg-card border ${s.border} rounded-md px-2 py-2`}>
            <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className={`font-display text-lg ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-1">
          {(['unread', 'all'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn('font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded border transition-colors',
                filterStatus === s ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border/40 text-muted-foreground hover:text-primary')}>
              {s === 'unread' ? `Unread (${unreadCount})` : 'All'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTER_TYPES.map(t => {
            const tc = typeConfig[t];
            return (
              <button key={t} onClick={() => setFilterType(t)}
                className={cn('font-mono text-[9px] px-2 py-1 rounded border transition-colors',
                  filterType === t
                    ? t === 'all' ? 'border-primary/50 bg-primary/10 text-primary' : tc.color
                    : 'border-border/40 text-muted-foreground hover:text-foreground')}>
                {t === 'all' ? 'All' : (tc?.label || t)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="font-mono text-xs text-muted-foreground animate-pulse py-8 text-center">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="border border-border/30 rounded-lg p-10 text-center">
          <BellOff className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-mono text-sm text-muted-foreground">
            {filterStatus === 'unread' ? 'All caught up — no unread notifications' : 'No notifications match this filter'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(notif => {
            const tc = typeConfig[notif.type] || typeConfig.system;
            const isExpanded = expanded === notif.id;
            const isUnread = notif.status === 'unread';
            return (
              <div key={notif.id}
                className={cn('rounded-md border transition-all',
                  isUnread ? 'border-border/60 bg-card' : 'border-border/20 bg-card/50 opacity-70',
                  notif.priority === 'urgent' && isUnread ? 'border-red-700/50' : '',
                  notif.priority === 'high' && isUnread ? 'border-orange-700/40' : ''
                )}
              >
                <div className="flex items-start gap-3 p-3 cursor-pointer" onClick={() => handleExpand(notif.id, notif.status)}>
                  {/* Unread dot */}
                  <div className={cn('h-2 w-2 rounded-full mt-1.5 shrink-0', isUnread ? 'bg-primary' : 'bg-transparent')} />
                  {/* Type icon */}
                  <div className={cn('h-7 w-7 rounded-md border flex items-center justify-center shrink-0', tc.color)}>
                    {tc.icon}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn('font-mono text-xs', isUnread ? 'text-foreground font-medium' : 'text-foreground/60')}>
                        {notif.title}
                      </p>
                      <span className="font-mono text-[9px] text-muted-foreground shrink-0">{timeSince(notif.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className={cn('text-[8px] font-mono border', tc.color)}>{tc.label}</Badge>
                      {notif.agent && <span className="font-mono text-[9px] text-muted-foreground">{notif.agent}</span>}
                      {(notif.priority === 'urgent' || notif.priority === 'high') && (
                        <span className={cn('font-mono text-[8px]', notif.priority === 'urgent' ? 'text-red-400' : 'text-orange-400')}>
                          {notif.priority.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-3 border-t border-border/20 space-y-2">
                    {notif.body && (
                      <p className="font-mono text-xs text-foreground/70 mt-2 whitespace-pre-wrap">{notif.body}</p>
                    )}
                    {notif.metadata && (
                      <pre className="font-mono text-[9px] text-accent bg-secondary/40 p-2 rounded overflow-auto max-h-24">
                        {JSON.stringify(notif.metadata, null, 2)}
                      </pre>
                    )}
                    <Button size="sm" onClick={() => dismiss(notif.id)}
                      className="h-6 text-[9px] font-mono bg-secondary/30 hover:bg-secondary/50 text-muted-foreground border border-border/40 mt-1">
                      Dismiss
                    </Button>
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
