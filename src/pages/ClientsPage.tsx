import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity, Pause, Square, Play, AlertTriangle, CheckCircle,
  Clock, Wifi, WifiOff, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Types ── */
interface ClientOS {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'paused' | 'stopped';
  last_heartbeat: string | null;
  mac_hostname: string | null;
  retainer_status: 'active' | 'overdue' | 'cancelled';
  monthly_amount: number;
  notes: string | null;
  status_changed_at: string | null;
  status_changed_by: string | null;
}

const B1 = '#4B9EFF';

function fmtFull(n: number) {
  return 'R' + Math.round(n).toLocaleString('en-ZA');
}

function timeSince(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days > 0)  return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0)  return `${mins}m ago`;
  return 'just now';
}

function isOnline(iso: string | null): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 10 * 60 * 1000; // 10 min
}

/* ── Status badge ── */
function StatusBadge({ status }: { status: ClientOS['status'] }) {
  const cfg = {
    active:  { bg: 'rgba(74,222,128,0.15)', color: '#4ADE80', border: 'rgba(74,222,128,0.3)', label: 'Active' },
    paused:  { bg: 'rgba(251,191,36,0.15)',  color: '#FBBF24', border: 'rgba(251,191,36,0.3)', label: 'Paused' },
    stopped: { bg: 'rgba(248,113,113,0.15)', color: '#F87171', border: 'rgba(248,113,113,0.3)', label: 'Stopped' },
  }[status];
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  );
}

/* ── Retainer badge ── */
function RetainerBadge({ status }: { status: ClientOS['retainer_status'] }) {
  const cfg = {
    active:    { color: '#4ADE80', label: 'Paid' },
    overdue:   { color: '#FBBF24', label: 'Overdue' },
    cancelled: { color: '#F87171', label: 'Cancelled' },
  }[status];
  return <span className="text-[10px] font-medium" style={{ color: cfg.color }}>{cfg.label}</span>;
}

/* ════════════════════════════════════════
   Page
════════════════════════════════════════ */
export default function ClientsPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  const [clients, setClients]   = useState<ClientOS[]>([]);
  const [loading, setLoading]   = useState(true);
  const [spin, setSpin]         = useState(false);
  const [changing, setChanging] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const db = supabase as any;

  const load = async (showSpin = false) => {
    if (showSpin) setSpin(true);
    const { data } = await db.from('client_os_registry').select('*').order('name');
    if (data) setClients(data as ClientOS[]);
    setLoading(false);
    if (showSpin) setTimeout(() => setSpin(false), 400);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel('clients-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_os_registry' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setStatus = async (slug: string, newStatus: ClientOS['status']) => {
    setChanging(slug);
    await db.from('client_os_registry').update({
      status: newStatus,
      status_changed_at: new Date().toISOString(),
      status_changed_by: 'mission_control',
    }).eq('slug', slug);
    setClients(p => p.map(c => c.slug === slug ? { ...c, status: newStatus } : c));
    setChanging(null);
  };

  /* ── Shared styles ── */
  const card = isDark ? {
    background: 'rgba(255,255,255,0.03)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '20px',
    boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset, 0 8px 32px rgba(0,0,0,0.4)',
  } as React.CSSProperties : {
    background: '#ffffff',
    border: '1px solid rgba(0,0,0,0.07)',
    borderRadius: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
  } as React.CSSProperties;

  const txt = {
    label:       isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.4)',
    body:        isDark ? 'rgba(255,255,255,0.7)'  : 'rgba(0,0,0,0.7)',
    muted:       isDark ? 'rgba(255,255,255,0.2)'  : 'rgba(0,0,0,0.3)',
    head:        isDark ? '#ffffff'                 : '#111111',
    sub:         isDark ? 'rgba(255,255,255,0.5)'  : 'rgba(0,0,0,0.5)',
    divider:     isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
    inputBg:     isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
  };

  /* ── Derived ── */
  const active  = clients.filter(c => c.status === 'active').length;
  const paused  = clients.filter(c => c.status === 'paused').length;
  const stopped = clients.filter(c => c.status === 'stopped').length;
  const totalMRR = clients.reduce((s, c) => s + (c.monthly_amount || 0), 0);
  const onlineCount = clients.filter(c => isOnline(c.last_heartbeat)).length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-5 w-5 rounded-full border-2 animate-spin"
        style={{ borderColor: B1, borderTopColor: 'transparent' }} />
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ── Header stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Clients', value: clients.length, icon: Activity, color: B1 },
          { label: 'Active',        value: active,         icon: CheckCircle, color: '#4ADE80' },
          { label: 'Online Now',    value: onlineCount,    icon: Wifi,        color: '#4ADE80' },
          { label: 'Monthly MRR',   value: fmtFull(totalMRR), icon: null,    color: B1 },
        ].map(stat => (
          <div key={stat.label} className="p-4" style={card}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-widest" style={{ color: txt.label }}>{stat.label}</span>
              {stat.icon && <stat.icon className="h-3.5 w-3.5" style={{ color: stat.color }} />}
            </div>
            <p className="text-2xl font-bold tabular-nums" style={{ color: txt.head }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Kill Switch Summary ── */}
      {(paused > 0 || stopped > 0) && (
        <div className="px-4 py-3 rounded-xl flex items-center gap-3"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: '#FBBF24' }} />
          <p className="text-[12px]" style={{ color: '#FBBF24' }}>
            {paused > 0 && `${paused} client${paused > 1 ? 's' : ''} paused`}
            {paused > 0 && stopped > 0 && ' · '}
            {stopped > 0 && `${stopped} client${stopped > 1 ? 's' : ''} stopped`}
            {' — kill switch active'}
          </p>
        </div>
      )}

      {/* ── Client cards ── */}
      <div className="space-y-3">
        {clients.map(client => {
          const online = isOnline(client.last_heartbeat);
          const isExpanded = expanded === client.slug;
          const isChanging = changing === client.slug;

          return (
            <div key={client.slug} style={{ ...card, borderRadius: '16px' }}>
              {/* Main row */}
              <div className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">

                  {/* Left: identity */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Online indicator */}
                    <div className="relative shrink-0">
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center"
                        style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}>
                        {online
                          ? <Wifi className="h-4 w-4" style={{ color: B1 }} />
                          : <WifiOff className="h-4 w-4" style={{ color: txt.muted }} />
                        }
                      </div>
                      <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2"
                        style={{
                          background: online ? '#4ADE80' : txt.muted,
                          borderColor: isDark ? '#0a0a0a' : '#fff',
                          boxShadow: online && isDark ? '0 0 6px #4ADE80' : 'none',
                        }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold truncate" style={{ color: txt.head }}>{client.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px]" style={{ color: txt.muted }}>
                          {client.mac_hostname || client.slug}
                        </span>
                        {client.last_heartbeat && (
                          <>
                            <span style={{ color: txt.muted, fontSize: 8 }}>·</span>
                            <Clock className="h-2.5 w-2.5 shrink-0" style={{ color: txt.muted }} />
                            <span className="text-[10px]" style={{ color: txt.muted }}>
                              {timeSince(client.last_heartbeat)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Center: status + retainer */}
                  <div className="hidden md:flex items-center gap-3">
                    <StatusBadge status={client.status} />
                    <RetainerBadge status={client.retainer_status} />
                    <span className="text-[12px] font-medium" style={{ color: txt.sub }}>
                      {fmtFull(client.monthly_amount)}/mo
                    </span>
                  </div>

                  {/* Right: kill switch buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isChanging ? (
                      <div className="h-4 w-4 rounded-full border-2 animate-spin"
                        style={{ borderColor: B1, borderTopColor: 'transparent' }} />
                    ) : (
                      <>
                        <button
                          disabled={client.status === 'active'}
                          onClick={() => setStatus(client.slug, 'active')}
                          title="Resume — all agents run"
                          className={cn(
                            'p-2 rounded-lg transition-all',
                            client.status === 'active' ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-80'
                          )}
                          style={{
                            background: client.status !== 'active' ? 'rgba(74,222,128,0.15)' : txt.inputBg,
                            border: `1px solid ${client.status !== 'active' ? 'rgba(74,222,128,0.3)' : 'transparent'}`,
                            color: client.status !== 'active' ? '#4ADE80' : txt.muted,
                          }}>
                          <Play className="h-3.5 w-3.5" />
                        </button>
                        <button
                          disabled={client.status === 'paused'}
                          onClick={() => setStatus(client.slug, 'paused')}
                          title="Pause — outbound agents stop, monitoring stays"
                          className={cn(
                            'p-2 rounded-lg transition-all',
                            client.status === 'paused' ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-80'
                          )}
                          style={{
                            background: client.status === 'paused' ? 'rgba(251,191,36,0.15)' : txt.inputBg,
                            border: `1px solid ${client.status === 'paused' ? 'rgba(251,191,36,0.3)' : 'transparent'}`,
                            color: client.status === 'paused' ? '#FBBF24' : txt.muted,
                          }}>
                          <Pause className="h-3.5 w-3.5" />
                        </button>
                        <button
                          disabled={client.status === 'stopped'}
                          onClick={() => setStatus(client.slug, 'stopped')}
                          title="Stop — all agents killed except daemon"
                          className={cn(
                            'p-2 rounded-lg transition-all',
                            client.status === 'stopped' ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-80'
                          )}
                          style={{
                            background: client.status === 'stopped' ? 'rgba(248,113,113,0.15)' : txt.inputBg,
                            border: `1px solid ${client.status === 'stopped' ? 'rgba(248,113,113,0.3)' : 'transparent'}`,
                            color: client.status === 'stopped' ? '#F87171' : txt.muted,
                          }}>
                          <Square className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}

                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : client.slug)}
                      className="p-2 rounded-lg transition-all"
                      style={{ color: txt.muted, background: txt.inputBg }}>
                      {isExpanded
                        ? <ChevronUp className="h-3.5 w-3.5" />
                        : <ChevronDown className="h-3.5 w-3.5" />
                      }
                    </button>
                  </div>
                </div>

                {/* Mobile: status + retainer row */}
                <div className="flex items-center gap-2 mt-2 md:hidden">
                  <StatusBadge status={client.status} />
                  <RetainerBadge status={client.retainer_status} />
                  <span className="text-[11px]" style={{ color: txt.muted }}>{fmtFull(client.monthly_amount)}/mo</span>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-5 pb-4 space-y-3" style={{ borderTop: `1px solid ${txt.divider}` }}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-4">
                    {[
                      { label: 'Slug',         value: client.slug },
                      { label: 'Hostname',     value: client.mac_hostname || 'unknown' },
                      { label: 'Last Heartbeat', value: client.last_heartbeat ? new Date(client.last_heartbeat).toLocaleString() : 'never' },
                      { label: 'Status Since', value: client.status_changed_at ? new Date(client.status_changed_at).toLocaleString() : 'unknown' },
                      { label: 'Changed By',   value: client.status_changed_by || 'system' },
                      { label: 'Monthly',      value: fmtFull(client.monthly_amount) },
                    ].map(f => (
                      <div key={f.label}>
                        <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: txt.label }}>{f.label}</p>
                        <p className="text-[12px] font-medium break-all" style={{ color: txt.body }}>{f.value}</p>
                      </div>
                    ))}
                  </div>
                  {client.notes && (
                    <p className="text-[11px] pt-1" style={{ color: txt.muted, borderTop: `1px solid ${txt.divider}` }}>
                      {client.notes}
                    </p>
                  )}

                  {/* Kill switch legend */}
                  <div className="flex gap-4 pt-2" style={{ borderTop: `1px solid ${txt.divider}` }}>
                    {[
                      { icon: Play,  color: '#4ADE80', label: 'Active — all agents run' },
                      { icon: Pause, color: '#FBBF24', label: 'Paused — outbound stops, monitoring stays' },
                      { icon: Square, color: '#F87171', label: 'Stopped — all agents off' },
                    ].map(({ icon: Icon, color, label }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <Icon className="h-3 w-3 shrink-0" style={{ color }} />
                        <span className="text-[10px]" style={{ color: txt.muted }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Refresh ── */}
      <div className="flex justify-end">
        <button onClick={() => load(true)}
          className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all"
          style={{ color: txt.muted, background: txt.inputBg }}>
          <RefreshCw className={cn('h-3.5 w-3.5', spin && 'animate-spin')} />
          Refresh
        </button>
      </div>

    </div>
  );
}
