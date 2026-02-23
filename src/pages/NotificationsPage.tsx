import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Mail, AlertTriangle, CheckCircle2, Activity, GitBranch, Zap, Send, BellOff, RefreshCw, X } from 'lucide-react';

/* ── Types ── */
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

/* ── Palette ── */
const B1 = '#4B9EFF';
const CARD: React.CSSProperties = {
  background: 'var(--s-card)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid var(--s-card-b)',
  borderRadius: '16px',
  boxShadow: 'var(--s-card-shadow)',
};

/* ── Type config — all electric blue, differentiated by icon only ── */
const typeIcon: Record<string, React.ReactNode> = {
  email_inbound: <Mail className="h-3.5 w-3.5" />,
  email_sent:    <Send className="h-3.5 w-3.5" />,
  escalation:    <AlertTriangle className="h-3.5 w-3.5" />,
  approval:      <CheckCircle2 className="h-3.5 w-3.5" />,
  heartbeat:     <Activity className="h-3.5 w-3.5" />,
  outreach:      <Zap className="h-3.5 w-3.5" />,
  repo:          <GitBranch className="h-3.5 w-3.5" />,
  system:        <Activity className="h-3.5 w-3.5" />,
  reminder:      <Bell className="h-3.5 w-3.5" />,
};

const typeLabel: Record<string, string> = {
  email_inbound: 'Email In',
  email_sent:    'Email Sent',
  escalation:    'Escalation',
  approval:      'Approval',
  heartbeat:     'Heartbeat',
  outreach:      'Outreach',
  repo:          'Repo',
  system:        'System',
  reminder:      'Reminder',
};

const FILTER_TYPES = ['all', 'email_inbound', 'escalation', 'approval', 'heartbeat', 'outreach', 'repo', 'system'];

function timeSince(ts: string | null) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

/* ── Stat chip ── */
function Stat({ label, value, glow }: { label: string; value: number; glow?: boolean }) {
  return (
    <div style={CARD} className="flex flex-col items-center justify-center py-3 px-2 gap-0.5">
      <span
        className="text-xl font-bold tabular-nums"
        style={{ color: glow ? B1 : 'var(--tc-85)', textShadow: glow ? `0 0 16px ${B1}88` : 'none' }}
      >
        {value}
      </span>
      <span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--tc-30)' }}>{label}</span>
    </div>
  );
}

/* ── Filter chip ── */
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[10px] font-medium px-3 py-1.5 rounded-full transition-all"
      style={{
        background: active ? `${B1}18` : 'var(--s-hover)',
        border: `1px solid ${active ? `${B1}55` : 'var(--s-pill-b)'}`,
        color: active ? B1 : 'var(--tc-40)',
        boxShadow: active ? `0 0 12px ${B1}22` : 'none',
      }}
    >
      {label}
    </button>
  );
}

/* ════════════════════════════════════════
   Page
════════════════════════════════════════ */
export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]   = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [filterType, setFilterType]     = useState('all');
  const [filterStatus, setFilterStatus] = useState<'unread' | 'all'>('unread');
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetch = async (spin = false) => {
    if (spin) setSpinning(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .neq('status', 'dismissed')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error) setNotifications((data as Notification[]) || []);
    setLoading(false);
    if (spin) setTimeout(() => setSpinning(false), 500);
  };

  useEffect(() => {
    fetch();
    const ch = supabase.channel('notif_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ status: 'read', read_at: new Date().toISOString() }).eq('id', id);
  };

  const dismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('notifications').update({ status: 'dismissed' }).eq('id', id);
  };

  const markAllRead = async () => {
    await supabase.from('notifications')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('status', 'unread');
  };

  const handleExpand = (id: string, status: string) => {
    setExpanded(expanded === id ? null : id);
    if (status === 'unread') markRead(id);
  };

  const unreadCount   = notifications.filter(n => n.status === 'unread').length;
  const urgentCount   = notifications.filter(n => n.priority === 'urgent' && n.status === 'unread').length;
  const escalCount    = notifications.filter(n => n.type === 'escalation' && n.status === 'unread').length;

  const filtered = notifications.filter(n => {
    const matchType   = filterType === 'all' || n.type === filterType;
    const matchStatus = filterStatus === 'all' || n.status === 'unread';
    return matchType && matchStatus;
  });

  return (
    <div className="space-y-4 pb-24 sm:pb-6">

      {/* ── Stats row ── */}
      <div className="grid grid-cols-4 gap-2">
        <Stat label="Unread"     value={unreadCount} glow />
        <Stat label="Urgent"     value={urgentCount} />
        <Stat label="Escalation" value={escalCount} />
        <Stat label="Total"      value={notifications.length} />
      </div>

      {/* ── Toolbar ── */}
      <div style={CARD} className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Chip label={`Unread (${unreadCount})`} active={filterStatus === 'unread'} onClick={() => setFilterStatus('unread')} />
          <Chip label="All" active={filterStatus === 'all'} onClick={() => setFilterStatus('all')} />
          <div className="w-px h-4 bg-white/10 mx-1" />
          {FILTER_TYPES.map(t => (
            <Chip
              key={t}
              label={t === 'all' ? 'All types' : (typeLabel[t] ?? t)}
              active={filterType === t}
              onClick={() => setFilterType(t)}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-[10px] font-medium px-3 py-1.5 rounded-full transition-all"
              style={{
                background: 'var(--s-hover)',
                border: '1px solid var(--s-pill-b)',
                color: 'var(--tc-50)',
              }}
            >
              Mark all read
            </button>
          )}
          <button
            onClick={() => fetch(true)}
            className="h-8 w-8 flex items-center justify-center rounded-full transition-all"
            style={{ background: 'var(--s-hover)', border: '1px solid var(--s-pill-b)', color: 'var(--tc-40)' }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${spinning ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Feed ── */}
      {loading ? (
        <div className="text-[11px] text-center py-12" style={{ color: 'var(--tc-20)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ ...CARD, borderRadius: '20px' }} className="flex flex-col items-center justify-center py-16 gap-3">
          <BellOff className="h-8 w-8" style={{ color: 'var(--tc-15)' }} />
          <p className="text-sm" style={{ color: 'var(--tc-25)' }}>
            {filterStatus === 'unread' ? 'All caught up' : 'No notifications match this filter'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(n => {
            const isUnread   = n.status === 'unread';
            const isExpanded = expanded === n.id;
            const isUrgent   = n.priority === 'urgent';
            const icon       = typeIcon[n.type] ?? typeIcon.system;
            const label      = typeLabel[n.type] ?? n.type;

            return (
              <div
                key={n.id}
                style={{
                  background: isUnread ? 'var(--s-hover)' : 'var(--s-row)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid var(--s-row-b)',
                  borderRadius: '14px',
                  opacity: isUnread ? 1 : 0.5,
                  transition: 'all 0.2s',
                }}
              >
                {/* Row */}
                <div
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => handleExpand(n.id, n.status)}
                >
                  {/* Priority dot */}
                  <div className="flex items-center shrink-0 pt-2.5">
                    <div
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: !isUnread
                          ? 'rgba(255,255,255,0.12)'
                          : isUrgent
                            ? B1
                            : `${B1}99`,
                        boxShadow: !isUnread
                          ? 'none'
                          : isUrgent
                            ? `0 0 7px ${B1}, 0 0 14px ${B1}66`
                            : `0 0 5px ${B1}66`,
                        flexShrink: 0,
                      }}
                    />
                  </div>

                  {/* Icon badge */}
                  <div
                    className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: isUnread ? `${B1}15` : 'var(--s-hover)',
                      color: isUnread ? B1 : 'var(--tc-25)',
                      boxShadow: isUnread ? `0 0 10px ${B1}25` : 'none',
                    }}
                  >
                    {icon}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="text-[13px] font-medium leading-snug"
                        style={{ color: isUnread ? 'var(--tc-90)' : 'var(--tc-45)' }}
                      >
                        {n.title}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px]" style={{ color: 'var(--tc-25)' }}>{timeSince(n.created_at)}</span>
                        <button
                          onClick={(e) => dismiss(n.id, e)}
                          className="h-5 w-5 flex items-center justify-center rounded transition-all hover:bg-white/10"
                          style={{ color: 'var(--tc-20)' }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{
                          background: `${B1}12`,
                          color: isUnread ? `${B1}cc` : 'var(--tc-25)',
                          border: `1px solid ${B1}22`,
                        }}
                      >
                        {label}
                      </span>
                      {n.agent && (
                        <span className="text-[10px]" style={{ color: 'var(--tc-25)' }}>
                          {n.agent}
                        </span>
                      )}
                      {isUrgent && (
                        <span
                          className="text-[9px] font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded-full"
                          style={{ background: `${B1}18`, color: B1, border: `1px solid ${B1}44`, boxShadow: `0 0 8px ${B1}33` }}
                        >
                          Urgent
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div
                    className="px-4 pb-4"
                    style={{ borderTop: '1px solid var(--s-row-b)' }}
                  >
                    {n.body && (
                      <p className="text-[12px] leading-relaxed mt-3 whitespace-pre-wrap" style={{ color: 'var(--tc-50)' }}>
                        {n.body}
                      </p>
                    )}
                    {n.metadata && (
                      <pre
                        className="text-[10px] mt-3 p-3 rounded-xl overflow-auto max-h-32 font-mono"
                        style={{
                          background: 'rgba(75,158,255,0.05)',
                          border: '1px solid rgba(75,158,255,0.12)',
                          color: `${B1}99`,
                        }}
                      >
                        {JSON.stringify(n.metadata, null, 2)}
                      </pre>
                    )}
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
