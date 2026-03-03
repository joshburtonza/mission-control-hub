import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity, Pause, Play, AlertTriangle, CheckCircle,
  RefreshCw, ChevronDown, ChevronUp, DollarSign, Archive, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Types ── */
interface PipelineItem {
  name: string;
  status: string;
  type?: string;
  description?: string;
  added?: string;
}

interface Client {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'paused' | 'archived';
  notes: string | null;
  contact_person: string | null;
  project_name: string | null;
  email_addresses: string[] | null;
  profile: {
    contract?: { retainer_monthly?: number };
    team?: Array<{ name: string; role: string; email: string }>;
    current_project?: { phase?: string; platform_url?: string };
    pipeline?: PipelineItem[];
  } | null;
  updated_at: string | null;
}

function extractPauseMsg(notes: string | null): string | null {
  if (!notes) return null;
  const line = notes.split('\n').find(l => l.startsWith('PAUSE_MSG:'));
  return line ? line.replace('PAUSE_MSG:', '').trim() : null;
}

function getMonthlyAmount(client: Client): number {
  return client.profile?.contract?.retainer_monthly ?? 0;
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

const B1 = '#4B9EFF';

/* ── Status badge ── */
function StatusBadge({ status }: { status: Client['status'] }) {
  const cfg = {
    active:   { bg: 'rgba(74,222,128,0.15)',  color: '#4ADE80', border: 'rgba(74,222,128,0.3)',  label: 'Active'   },
    paused:   { bg: 'rgba(251,191,36,0.15)',  color: '#FBBF24', border: 'rgba(251,191,36,0.3)',  label: 'Paused'   },
    archived: { bg: 'rgba(148,163,184,0.15)', color: '#94A3B8', border: 'rgba(148,163,184,0.3)', label: 'Archived' },
  }[status];
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  );
}

/* ════════════════════════════════════════
   Page
════════════════════════════════════════ */
export default function ClientsPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  const [clients, setClients]   = useState<Client[]>([]);
  const [loading, setLoading]   = useState(true);
  const [spin, setSpin]         = useState(false);
  const [changing, setChanging] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pauseMsg, setPauseMsg] = useState<Record<string, string>>({});

  const load = async (showSpin = false) => {
    if (showSpin) setSpin(true);
    const { data } = await supabase
      .from('clients')
      .select('id,slug,name,status,notes,contact_person,project_name,email_addresses,profile,updated_at')
      .neq('slug', 'aos')           // hide internal AOS entry
      .order('name');
    if (data) {
      setClients(data as unknown as Client[]);
      const msgs: Record<string, string> = {};
      for (const c of data) {
        const msg = extractPauseMsg((c as Client).notes);
        if (msg) msgs[(c as Client).slug] = msg;
      }
      setPauseMsg(msgs);
    }
    setLoading(false);
    if (showSpin) setTimeout(() => setSpin(false), 400);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel('clients-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setStatus = async (slug: string, newStatus: Client['status'], msg?: string) => {
    setChanging(slug);
    const now = new Date().toISOString();

    // Build notes update — preserve existing notes, update PAUSE_MSG prefix
    const existing = clients.find(c => c.slug === slug);
    let notes = existing?.notes || '';
    // Remove any existing PAUSE_MSG line
    notes = notes.split('\n').filter(l => !l.startsWith('PAUSE_MSG:')).join('\n');

    if (newStatus === 'paused' && msg) {
      notes = `PAUSE_MSG:${msg}\n[${now.slice(0,10)}] Paused via Mission Control\n${notes}`.trim();
    } else if (newStatus === 'active') {
      notes = `[${now.slice(0,10)}] Resumed via Mission Control\n${notes}`.trim();
    }

    await supabase.from('clients').update({
      status: newStatus,
      notes,
      updated_at: now,
    }).eq('slug', slug);

    setClients(p => p.map(c => c.slug === slug ? { ...c, status: newStatus, notes } : c));
    if (newStatus === 'paused' && msg) {
      setPauseMsg(p => ({ ...p, [slug]: msg }));
    } else if (newStatus === 'active') {
      setPauseMsg(p => { const n = { ...p }; delete n[slug]; return n; });
    }
    setChanging(null);
  };

  /* ── Pause dialog ── */
  const [pauseTarget, setPauseTarget] = useState<string | null>(null);
  const [pauseReason, setPauseReason] = useState('');

  const handlePauseClick = (slug: string) => {
    setPauseTarget(slug);
    setPauseReason('');
  };

  const confirmPause = async () => {
    if (!pauseTarget) return;
    await setStatus(pauseTarget, 'paused', pauseReason || 'Service temporarily paused. Contact Amalfi AI.');
    setPauseTarget(null);
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
    label:   isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.4)',
    body:    isDark ? 'rgba(255,255,255,0.7)'  : 'rgba(0,0,0,0.7)',
    muted:   isDark ? 'rgba(255,255,255,0.2)'  : 'rgba(0,0,0,0.3)',
    head:    isDark ? '#ffffff'                 : '#111111',
    sub:     isDark ? 'rgba(255,255,255,0.5)'  : 'rgba(0,0,0,0.5)',
    divider: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
    inputBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
  };

  const activeClients  = clients.filter(c => c.status === 'active').length;
  const pausedClients  = clients.filter(c => c.status === 'paused').length;
  const totalMRR       = clients
    .filter(c => c.status === 'active')
    .reduce((s, c) => s + getMonthlyAmount(c), 0);

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
          { label: 'Total Clients', value: clients.length,          icon: Activity,      color: B1 },
          { label: 'Active',        value: activeClients,            icon: CheckCircle,   color: '#4ADE80' },
          { label: 'Paused',        value: pausedClients,            icon: Pause,         color: '#FBBF24' },
          { label: 'Active MRR',    value: `R${Math.round(totalMRR).toLocaleString('en-ZA')}`, icon: DollarSign, color: B1 },
        ].map(stat => (
          <div key={stat.label} className="p-4" style={card}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-widest" style={{ color: txt.label }}>{stat.label}</span>
              <stat.icon className="h-3.5 w-3.5" style={{ color: stat.color }} />
            </div>
            <p className="text-2xl font-bold tabular-nums" style={{ color: txt.head }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Kill switch alert ── */}
      {pausedClients > 0 && (
        <div className="px-4 py-3 rounded-xl flex items-center gap-3"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: '#FBBF24' }} />
          <p className="text-[12px]" style={{ color: '#FBBF24' }}>
            {pausedClients} client{pausedClients > 1 ? 's' : ''} paused — web app showing maintenance page, agents skipping tasks
          </p>
        </div>
      )}

      {/* ── Client cards ── */}
      <div className="space-y-3">
        {clients.map(client => {
          const isExpanded = expanded === client.slug;
          const isChanging = changing === client.slug;
          const monthly    = getMonthlyAmount(client);
          const msg        = pauseMsg[client.slug];
          const isPaused   = client.status === 'paused';

          return (
            <div key={client.slug} style={{ ...card, borderRadius: '16px' }}>
              {/* ── Main row ── */}
              <div className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">

                  {/* Left: identity */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-[13px]"
                      style={{
                        background: isPaused ? 'rgba(251,191,36,0.12)' : 'rgba(75,158,255,0.12)',
                        color:      isPaused ? '#FBBF24' : B1,
                        border:     `1px solid ${isPaused ? 'rgba(251,191,36,0.2)' : 'rgba(75,158,255,0.2)'}`,
                      }}>
                      {client.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold truncate" style={{ color: txt.head }}>{client.name}</p>
                      <p className="text-[10px] truncate" style={{ color: txt.muted }}>
                        {client.project_name || client.slug}
                        {client.contact_person && ` · ${client.contact_person}`}
                      </p>
                    </div>
                  </div>

                  {/* Center */}
                  <div className="hidden md:flex items-center gap-3">
                    <StatusBadge status={client.status} />
                    {monthly > 0 && (
                      <span className="text-[12px] font-medium" style={{ color: txt.sub }}>
                        R{Math.round(monthly).toLocaleString('en-ZA')}/mo
                      </span>
                    )}
                  </div>

                  {/* Right: kill switch buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isChanging ? (
                      <div className="h-4 w-4 rounded-full border-2 animate-spin"
                        style={{ borderColor: B1, borderTopColor: 'transparent' }} />
                    ) : (
                      <>
                        {/* Resume */}
                        <button
                          disabled={client.status === 'active'}
                          onClick={() => setStatus(client.slug, 'active')}
                          title="Resume — restore full access"
                          className={cn('p-2 rounded-lg transition-all',
                            client.status !== 'active' ? 'hover:opacity-80' : 'opacity-30 cursor-not-allowed'
                          )}
                          style={{
                            background: client.status !== 'active' ? 'rgba(74,222,128,0.15)' : txt.inputBg,
                            border: `1px solid ${client.status !== 'active' ? 'rgba(74,222,128,0.3)' : 'transparent'}`,
                            color: client.status !== 'active' ? '#4ADE80' : txt.muted,
                          }}>
                          <Play className="h-3.5 w-3.5" />
                        </button>

                        {/* Pause */}
                        <button
                          disabled={client.status === 'paused'}
                          onClick={() => handlePauseClick(client.slug)}
                          title="Pause — web app blocked, agents stop"
                          className={cn('p-2 rounded-lg transition-all',
                            client.status !== 'paused' ? 'hover:opacity-80' : 'opacity-30 cursor-not-allowed'
                          )}
                          style={{
                            background: client.status === 'paused' ? 'rgba(251,191,36,0.15)' : txt.inputBg,
                            border: `1px solid ${client.status === 'paused' ? 'rgba(251,191,36,0.3)' : 'transparent'}`,
                            color: client.status === 'paused' ? '#FBBF24' : txt.muted,
                          }}>
                          <Pause className="h-3.5 w-3.5" />
                        </button>

                        {/* Archive (end of engagement) */}
                        <button
                          disabled={client.status === 'archived'}
                          onClick={() => setStatus(client.slug, 'archived')}
                          title="Archive — end of engagement, remove from system"
                          className={cn('p-2 rounded-lg transition-all',
                            client.status !== 'archived' ? 'hover:opacity-80' : 'opacity-30 cursor-not-allowed'
                          )}
                          style={{
                            background: client.status === 'archived' ? 'rgba(148,163,184,0.15)' : txt.inputBg,
                            border: `1px solid ${client.status === 'archived' ? 'rgba(148,163,184,0.3)' : 'transparent'}`,
                            color: client.status === 'archived' ? '#94A3B8' : txt.muted,
                          }}>
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => setExpanded(isExpanded ? null : client.slug)}
                      className="p-2 rounded-lg transition-all"
                      style={{ color: txt.muted, background: txt.inputBg }}>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Mobile status row */}
                <div className="flex items-center gap-2 mt-2 md:hidden">
                  <StatusBadge status={client.status} />
                  {monthly > 0 && (
                    <span className="text-[11px]" style={{ color: txt.muted }}>
                      R{Math.round(monthly).toLocaleString('en-ZA')}/mo
                    </span>
                  )}
                </div>

                {/* Pause message banner */}
                {isPaused && msg && (
                  <div className="mt-3 px-3 py-2 rounded-lg flex items-start gap-2"
                    style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: '#FBBF24' }} />
                    <p className="text-[11px]" style={{ color: '#FBBF24' }}>{msg}</p>
                  </div>
                )}

                {/* Pipeline items */}
                {(client.profile?.pipeline ?? []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(client.profile!.pipeline!).map((item, i) => {
                      const statusColors: Record<string, { bg: string; color: string; border: string }> = {
                        scoping:     { bg: 'rgba(168,85,247,0.12)',  color: '#C084FC', border: 'rgba(168,85,247,0.25)' },
                        in_progress: { bg: 'rgba(75,158,255,0.12)',  color: '#4B9EFF', border: 'rgba(75,158,255,0.25)' },
                        done:        { bg: 'rgba(74,222,128,0.12)',  color: '#4ADE80', border: 'rgba(74,222,128,0.25)' },
                      };
                      const c = statusColors[item.status] ?? statusColors.scoping;
                      return (
                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                          style={{ background: c.bg, border: `1px solid ${c.border}` }}
                          title={item.description}>
                          <Zap className="h-2.5 w-2.5 shrink-0" style={{ color: c.color }} />
                          <span className="text-[10px] font-semibold" style={{ color: c.color }}>{item.name}</span>
                          <span className="text-[9px] uppercase tracking-wider opacity-70" style={{ color: c.color }}>{item.status}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Expanded detail ── */}
              {isExpanded && (
                <div className="px-5 pb-4 space-y-3" style={{ borderTop: `1px solid ${txt.divider}` }}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-4">
                    {[
                      { label: 'Slug',           value: client.slug },
                      { label: 'Monthly Retainer', value: monthly > 0 ? `R${Math.round(monthly).toLocaleString('en-ZA')}` : 'Not set' },
                      { label: 'Platform',       value: client.profile?.current_project?.platform_url || 'Unknown' },
                      { label: 'Phase',          value: client.profile?.current_project?.phase || 'Unknown' },
                      { label: 'Last Updated',   value: client.updated_at ? timeSince(client.updated_at) : 'unknown' },
                      { label: 'Emails',         value: client.email_addresses?.join(', ') || 'None' },
                    ].map(f => (
                      <div key={f.label}>
                        <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: txt.label }}>{f.label}</p>
                        <p className="text-[11px] font-medium break-all" style={{ color: txt.body }}>{f.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Kill switch legend */}
                  <div className="flex gap-4 pt-2" style={{ borderTop: `1px solid ${txt.divider}` }}>
                    {[
                      { icon: Play,    color: '#4ADE80', label: 'Active — all systems running' },
                      { icon: Pause,   color: '#FBBF24', label: 'Paused — web app blocked, agents skip' },
                      { icon: Archive, color: '#94A3B8', label: 'Archived — end of engagement' },
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

      {/* ── Pause confirmation modal ── */}
      {pauseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setPauseTarget(null); }}>
          <div className="w-full max-w-md p-6 rounded-2xl space-y-4"
            style={{
              background: isDark ? 'rgba(15,15,20,0.95)' : '#fff',
              border: '1px solid rgba(251,191,36,0.3)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            }}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)' }}>
                <Pause className="h-5 w-5" style={{ color: '#FBBF24' }} />
              </div>
              <div>
                <p className="text-[14px] font-semibold" style={{ color: txt.head }}>
                  Pause {clients.find(c => c.slug === pauseTarget)?.name}?
                </p>
                <p className="text-[11px]" style={{ color: txt.muted }}>
                  Web app will show maintenance page immediately
                </p>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest mb-1.5 block" style={{ color: txt.label }}>
                Reason shown to client (optional)
              </label>
              <input
                autoFocus
                value={pauseReason}
                onChange={e => setPauseReason(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmPause(); if (e.key === 'Escape') setPauseTarget(null); }}
                placeholder="e.g. Invoice overdue — please contact us to restore access"
                className="w-full text-[12px] px-3 py-2.5 rounded-xl outline-none"
                style={{
                  background: txt.inputBg,
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: txt.body,
                }}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPauseTarget(null)}
                className="px-4 py-2 rounded-xl text-[12px] font-medium"
                style={{ background: txt.inputBg, color: txt.muted }}>
                Cancel
              </button>
              <button
                onClick={confirmPause}
                className="px-4 py-2 rounded-xl text-[12px] font-medium"
                style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.3)' }}>
                Pause Client
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
