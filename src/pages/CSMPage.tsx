import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  CheckCircle, Mail, Clock, MessageSquare, Send,
  ExternalLink, Calendar, Briefcase, Users,
} from 'lucide-react';
import { SwipeableCard } from '@/components/ui/swipeable-card';

/* ── Constants ── */
const B = '#4B9EFF';

const CLIENT_COLORS: Record<string, string> = {
  race_technik:       '#FF6B35',
  ascend_lc:          '#4B9EFF',
  favorite_logistics: '#10B981',
  vanta_studios:      '#8B5CF6',
};

const cardStyle = {
  background:         'var(--s-card)',
  backdropFilter:     'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border:             '1px solid var(--s-card-b)',
  borderRadius:       '20px',
  boxShadow:          'var(--s-card-shadow)',
} as React.CSSProperties;

/* ── Types ── */
interface Client {
  id: string;
  name: string;
  slug: string;
  project_name: string;
  contact_person: string;
  status: string;
  created_at: string;
  profile: any;
  sentiment: string;
}

interface EmailItem {
  id: string;
  from_email: string;
  to_email: string;
  subject: string;
  body: string | null;
  client: string | null;
  status: string | null;
  created_at: string | null;
  analysis: any;
  requires_approval: boolean | null;
  scheduled_send_at: string | null;
}

/* ── Helpers ── */
function timeSince(ts: string | null) {
  if (!ts) return '';
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 1)    return 'just now';
  if (m < 60)   return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

function timeUntil(ts: string | null) {
  if (!ts) return '~30m';
  const diff = new Date(ts).getTime() - Date.now();
  if (diff <= 0) return 'sending soon';
  const m = Math.ceil(diff / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function countdownDisplay(target: string | undefined | null): string | null {
  if (!target || target.toLowerCase() === 'none') return null;
  const d = new Date(target);
  if (isNaN(d.getTime())) return null;
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return 'Past due';
  const days = Math.floor(diff / 86400000);
  if (days < 1)  return 'Today';
  if (days === 1) return '1 day left';
  if (days < 30) return `${days} days left`;
  const months = Math.floor(days / 30);
  return `${months}mo left`;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/* ════════════════════════════════════════
   Client Tile
════════════════════════════════════════ */
function ClientTile({
  client, pendingCount, lastActivity, selected, onClick,
}: {
  client: Client;
  pendingCount: number;
  lastActivity: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  const color = CLIENT_COLORS[client.slug] || B;
  const cp = client.profile?.current_project;
  const countdown = countdownDisplay(cp?.target_completion);

  return (
    <button
      onClick={onClick}
      className="w-full text-left transition-all duration-200"
      style={{
        ...cardStyle,
        border: `1px solid ${selected ? `${color}45` : 'rgba(255,255,255,0.06)'}`,
        background: selected ? `${color}0F` : 'var(--s-card)',
        boxShadow: selected ? `0 0 24px ${color}18` : 'var(--s-card-shadow)',
        padding: '18px',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 text-base font-bold"
          style={{ background: `${color}20`, border: `1px solid ${color}30`, color }}
        >
          {client.name.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: 'var(--tc-90)' }}>{client.name}</p>
              <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--tc-40)' }}>
                {client.project_name}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
              {pendingCount > 0 && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded tabular-nums"
                  style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}
                >
                  {pendingCount}
                </span>
              )}
              <div
                className="h-2 w-2 rounded-full shrink-0"
                style={{
                  background: client.status === 'active' ? '#4ADE80' : '#6B7280',
                  boxShadow: client.status === 'active' ? '0 0 6px #4ADE8090' : 'none',
                }}
              />
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-[10px]" style={{ color: 'var(--tc-35)' }}>{client.contact_person}</span>
            {lastActivity && (
              <span className="text-[10px]" style={{ color: 'var(--tc-25)' }}>· {timeSince(lastActivity)}</span>
            )}
            {countdown && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                style={{ background: '#F59E0B12', color: '#F59E0B', border: '1px solid #F59E0B28' }}
              >
                {countdown}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ════════════════════════════════════════
   Client Detail Panel
════════════════════════════════════════ */
function ClientDetail({ client, emails }: { client: Client; emails: EmailItem[] }) {
  const color = CLIENT_COLORS[client.slug] || B;
  const cp = client.profile?.current_project;

  const latestOutbound = emails.find(
    e => (e.from_email?.includes('@amalfiai.com')) && (e.status === 'sent' || e.status === 'approved')
  );
  const latestInbound = emails.find(
    e => !e.from_email?.includes('@amalfiai.com') && e.client === client.slug
  );

  const startDate = new Date(client.created_at);
  const countdown = countdownDisplay(cp?.target_completion);

  const outboundBody = latestOutbound?.analysis?.draft_body || latestOutbound?.body || '';
  const outboundPreview = outboundBody ? stripHtml(outboundBody).substring(0, 220) : '';

  return (
    <div
      className="rounded-2xl p-5 space-y-5"
      style={{
        background: 'rgba(0,0,0,0.45)',
        border: `1px solid ${color}20`,
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--tc-90)' }}>{client.name}</h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--tc-40)' }}>
            {client.project_name} · {client.contact_person}
          </p>
        </div>
        {cp?.platform_url && (
          <a
            href={cp.platform_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg shrink-0"
            style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" />
            Open app
          </a>
        )}
      </div>

      {/* Latest Communication */}
      <div>
        <p className="text-[10px] uppercase tracking-widest mb-2.5 flex items-center gap-1.5"
          style={{ color: 'var(--tc-25)' }}>
          <Mail className="h-3 w-3" />
          Latest communication
        </p>

        {latestInbound && (
          <div
            className="rounded-xl p-3 mb-2"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-medium" style={{ color: 'var(--tc-40)' }}>
                {client.contact_person} → Sophia
              </span>
              <span className="text-[9px]" style={{ color: 'var(--tc-25)' }}>{timeSince(latestInbound.created_at)}</span>
            </div>
            <p className="text-[11px] font-medium" style={{ color: 'var(--tc-70)' }}>{latestInbound.subject}</p>
          </div>
        )}

        {latestOutbound ? (
          <div
            className="rounded-xl p-3"
            style={{ background: `${color}0A`, border: `1px solid ${color}18` }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-medium" style={{ color }}>
                Sophia → {client.contact_person}
              </span>
              <span className="text-[9px]" style={{ color: 'var(--tc-25)' }}>{timeSince(latestOutbound.created_at)}</span>
            </div>
            <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--tc-80)' }}>{latestOutbound.subject}</p>
            {outboundPreview && (
              <p className="text-[10px] leading-relaxed" style={{ color: 'var(--tc-40)' }}>
                {outboundPreview}{outboundPreview.length >= 220 ? '…' : ''}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--tc-30)' }}>No emails sent yet</p>
        )}
      </div>

      {/* Project Scope */}
      {cp && (
        <div>
          <p className="text-[10px] uppercase tracking-widest mb-2.5 flex items-center gap-1.5"
            style={{ color: 'var(--tc-25)' }}>
            <Briefcase className="h-3 w-3" />
            Project scope
          </p>
          <div
            className="rounded-xl p-3 space-y-2"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold" style={{ color: 'var(--tc-70)' }}>{cp.name}</p>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0"
                style={{ background: '#4ADE800F', color: '#4ADE80', border: '1px solid #4ADE8025' }}
              >
                {cp.phase || 'Active'}
              </span>
            </div>
            {cp.phase_status && (
              <p className="text-[10px]" style={{ color: 'var(--tc-40)' }}>{cp.phase_status}</p>
            )}
            {Array.isArray(cp.core_features) && cp.core_features.length > 0 && (
              <ul className="space-y-1 pt-1">
                {(cp.core_features as string[]).slice(0, 5).map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[10px]" style={{ color: 'var(--tc-40)' }}>
                    <span className="mt-0.5 shrink-0" style={{ color }}>·</span>
                    {f}
                  </li>
                ))}
                {cp.core_features.length > 5 && (
                  <li className="text-[10px] pl-3" style={{ color: 'var(--tc-25)' }}>
                    +{cp.core_features.length - 5} more features
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Contract & Timeline */}
      <div>
        <p className="text-[10px] uppercase tracking-widest mb-2.5 flex items-center gap-1.5"
          style={{ color: 'var(--tc-25)' }}>
          <Calendar className="h-3 w-3" />
          Contract & timeline
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div
            className="rounded-xl p-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--tc-25)' }}>Started</p>
            <p className="text-xs font-semibold" style={{ color: 'var(--tc-70)' }}>
              {startDate.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}
            </p>
            <p className="text-[9px] mt-0.5" style={{ color: 'var(--tc-30)' }}>
              {Math.floor((Date.now() - startDate.getTime()) / 86400000)}d active
            </p>
          </div>
          <div
            className="rounded-xl p-3"
            style={countdown
              ? { background: '#F59E0B08', border: '1px solid #F59E0B22' }
              : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--tc-25)' }}>Handover</p>
            {countdown ? (
              <>
                <p className="text-xs font-bold" style={{ color: '#F59E0B' }}>{countdown}</p>
                <p className="text-[9px] mt-0.5" style={{ color: 'var(--tc-30)' }}>{cp?.target_completion}</p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold" style={{ color: 'var(--tc-50)' }}>Ongoing</p>
                <p className="text-[9px] mt-0.5" style={{ color: 'var(--tc-25)' }}>Retainer</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Clients Tab
════════════════════════════════════════ */
function ClientsView({
  clients, emailsByClient, pendingEmails,
}: {
  clients: Client[];
  emailsByClient: Record<string, EmailItem[]>;
  pendingEmails: EmailItem[];
}) {
  const [selected, setSelected] = useState<string | null>(null);

  if (clients.length === 0) {
    return (
      <div style={cardStyle} className="p-12 text-center">
        <Users className="h-8 w-8 mx-auto mb-3" style={{ color: `${B}40` }} />
        <p className="text-sm" style={{ color: 'var(--tc-25)' }}>No clients found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {clients.map(c => {
        const emails = emailsByClient[c.slug] || [];
        const pending = pendingEmails.filter(e => e.client === c.slug).length;
        const lastActivity = emails[0]?.created_at ?? null;
        const isSelected = selected === c.id;

        return (
          <div key={c.id}>
            <ClientTile
              client={c}
              pendingCount={pending}
              lastActivity={lastActivity}
              selected={isSelected}
              onClick={() => setSelected(isSelected ? null : c.id)}
            />
            {isSelected && (
              <div className="mt-1">
                <ClientDetail client={c} emails={emails} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════
   Page
════════════════════════════════════════ */
export default function CSMPage() {
  const [clients, setClients]     = useState<Client[]>([]);
  const [pending, setPending]     = useState<EmailItem[]>([]);
  const [history, setHistory]     = useState<EmailItem[]>([]);
  const [allEmails, setAllEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [tab, setTab]             = useState<'clients' | 'queue' | 'history'>('clients');
  const [queueTab, setQueueTab]   = useState<'pending' | 'history'>('pending');
  const [selected, setSelected]   = useState<EmailItem | null>(null);

  const fetchData = async () => {
    const db = supabase as any;
    const [cRes, pRes, hRes, aRes] = await Promise.all([
      db.from('clients').select('*').eq('status', 'active').order('created_at', { ascending: true }),
      db.from('email_queue').select('*').in('status', ['awaiting_approval', 'auto_pending']).order('created_at', { ascending: false }),
      db.from('email_queue').select('*').in('status', ['approved', 'rejected', 'sent']).order('created_at', { ascending: false }).limit(50),
      db.from('email_queue').select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    if (!cRes.error) setClients((cRes.data as Client[]) || []);
    if (!pRes.error) setPending((pRes.data as EmailItem[]) || []);
    if (!hRes.error) setHistory((hRes.data as EmailItem[]) || []);
    if (!aRes.error) setAllEmails((aRes.data as EmailItem[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const db = supabase as any;
    const ch = db.channel('csm_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_queue' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, fetchData)
      .subscribe();
    return () => { db.removeChannel(ch); };
  }, []);

  /* Group emails by client slug */
  const emailsByClient = allEmails.reduce<Record<string, EmailItem[]>>((acc, e) => {
    if (!e.client) return acc;
    if (!acc[e.client]) acc[e.client] = [];
    acc[e.client].push(e);
    return acc;
  }, {});

  const handleAction = async (email: EmailItem, action: 'approved' | 'rejected') => {
    setProcessing(email.id);
    const db = supabase as any;
    try {
      await db.from('email_queue').update({ status: action }).eq('id', email.id);
      await db.from('approvals').insert({ email_queue_id: email.id, approval_type: 'escalation_response', request_body: `${action} — ${email.from_email}: ${email.subject}`, status: action, approved_by: 'Josh' });
      await db.from('audit_log').insert({ agent: 'Sophia CSM', action: `email_${action}`, details: { email_id: email.id, from: email.from_email, subject: email.subject, client: email.client }, status: 'success' });
      toast.success(action === 'approved' ? 'Approved — Sophia will send' : 'Rejected — held');
      setSelected(null);
    } catch { toast.error('Failed to process'); }
    finally { setProcessing(null); fetchData(); }
  };

  const handleHold = async (email: EmailItem) => {
    setProcessing(email.id);
    try {
      await (supabase as any).from('email_queue').update({ status: 'awaiting_approval' }).eq('id', email.id);
      toast.success('Held — moved to approval queue');
      setSelected(null);
    }
    catch { toast.error('Failed to hold'); }
    finally { setProcessing(null); fetchData(); }
  };

  const queueList     = queueTab === 'pending' ? pending : history;
  const totalSent     = allEmails.filter(e => e.status === 'approved' || e.status === 'sent').length;

  return (
    <div className="space-y-5">

      {/* ── Stats ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Clients',  value: clients.length, active: clients.length > 0 },
          { label: 'Pending',  value: pending.length, active: pending.length > 0 },
          { label: 'Sent',     value: totalSent,      active: true },
          { label: 'Rejected', value: history.filter(e => e.status === 'rejected').length, active: false },
        ].map(s => (
          <div key={s.label} style={cardStyle} className="p-4">
            <p className="text-[9px] text-white/25 uppercase tracking-widest mb-2">{s.label}</p>
            <p className="text-2xl font-bold tabular-nums"
              style={{ color: s.active && s.value > 0 ? B : 'var(--tc-50)' }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2">
        {([
          { key: 'clients', icon: Users,          label: `Clients (${clients.length})` },
          { key: 'queue',   icon: MessageSquare,  label: `Queue (${pending.length})` },
          { key: 'history', icon: Clock,          label: 'History' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all"
            style={tab === t.key
              ? { background: `${B}20`, border: `1px solid ${B}40`, color: B }
              : { background: 'var(--s-hover)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--tc-40)' }}>
            <t.icon className="h-3 w-3" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Clients tab ── */}
      {tab === 'clients' && (
        loading
          ? <div className="flex justify-center py-12"><div className="h-5 w-5 rounded-full border-2 animate-spin" style={{ borderColor: B, borderTopColor: 'transparent' }} /></div>
          : <ClientsView clients={clients} emailsByClient={emailsByClient} pendingEmails={pending} />
      )}

      {/* ── Queue tab ── */}
      {tab === 'queue' && (
        <>
          <div className="flex gap-2">
            {(['pending', 'history'] as const).map(t => (
              <button key={t} onClick={() => setQueueTab(t)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={queueTab === t
                  ? { background: `${B}15`, border: `1px solid ${B}30`, color: B }
                  : { background: 'var(--s-hover)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--tc-30)' }}>
                {t === 'pending' ? `Pending (${pending.length})` : `History (${history.length})`}
              </button>
            ))}
          </div>

          {queueTab === 'pending' && pending.length > 0 && (
            <p className="text-[10px] text-center sm:hidden" style={{ color: 'var(--tc-20)' }}>
              swipe right to approve · swipe left to reject
            </p>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-5 w-5 rounded-full border-2 animate-spin" style={{ borderColor: B, borderTopColor: 'transparent' }} />
            </div>
          ) : queueList.length === 0 ? (
            <div style={cardStyle} className="p-12 text-center">
              <CheckCircle className="h-8 w-8 mx-auto mb-3" style={{ color: `${B}60` }} />
              <p className="text-sm" style={{ color: 'var(--tc-25)' }}>
                {queueTab === 'pending' ? "Queue is clear — Sophia's on it" : 'No history yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {queueList.map(email => {
                const isAuto     = email.status === 'auto_pending';
                const isApproved = email.status === 'approved' || email.status === 'sent';
                const isSelected = selected?.id === email.id;
                const isPending  = queueTab === 'pending';
                return (
                  <div key={email.id}>
                    <SwipeableCard
                      disabled={!isPending || !!processing}
                      onSwipeRight={() => {
                        if (email.status === 'awaiting_approval' || email.status === 'auto_pending') handleAction(email, 'approved');
                      }}
                      onSwipeLeft={() => {
                        if (email.status === 'awaiting_approval') handleAction(email, 'rejected');
                        else if (email.status === 'auto_pending') handleHold(email);
                      }}
                      rightLabel="Approve"
                      leftLabel={email.status === 'auto_pending' ? 'Hold' : 'Reject'}
                      leftColor={email.status === 'auto_pending' ? '#6366f1' : '#ef4444'}
                    >
                      <button onClick={() => setSelected(isSelected ? null : email)} className="w-full text-left"
                        style={{ ...cardStyle, display: 'block', borderColor: isSelected ? `${B}40` : 'rgba(255,255,255,0.06)' }}>
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="h-1.5 w-1.5 rounded-full shrink-0 mt-1.5"
                                style={{ background: isAuto ? B : isApproved ? B : 'var(--tc-20)', boxShadow: (isAuto || isApproved) ? `0 0 5px ${B}` : 'none' }} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  {isAuto && (
                                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                                      style={{ background: `${B}20`, color: B, border: `1px solid ${B}30` }}>
                                      AUTO-SEND {timeUntil(email.scheduled_send_at)}
                                    </span>
                                  )}
                                  {email.status === 'awaiting_approval' && isPending && (
                                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                                      style={{ color: 'var(--tc-50)', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--s-pill-b)' }}>
                                      ESCALATION
                                    </span>
                                  )}
                                  {!isPending && (
                                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                                      style={isApproved
                                        ? { background: `${B}20`, color: B, border: `1px solid ${B}30` }
                                        : { background: 'rgba(255,255,255,0.06)', color: 'var(--tc-40)', border: '1px solid var(--s-pill-b)' }}>
                                      {email.status === 'approved' || email.status === 'sent' ? 'Sent' : 'Rejected'}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm truncate" style={{ color: 'var(--tc-80)' }}>{email.subject}</p>
                                <p className="text-[10px] mt-0.5" style={{ color: 'var(--tc-30)' }}>
                                  {email.from_email} · {email.client?.replace('_', ' ')}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] shrink-0" style={{ color: 'var(--tc-25)' }}>{timeSince(email.created_at)}</span>
                          </div>
                        </div>
                      </button>
                    </SwipeableCard>

                    {isSelected && (
                      <div className="mt-1 rounded-2xl p-5 space-y-4" style={{ background: '#111', border: '1px solid var(--s-pill-b)' }}>
                        {(email.body || email.analysis?.draft_body) && (
                          <div>
                            <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--tc-25)' }}>Email body</p>
                            <div className="rounded-xl p-3 max-h-48 overflow-auto text-xs leading-relaxed whitespace-pre-wrap"
                              style={{ color: 'var(--tc-60)', background: 'var(--s-card)', border: '1px solid rgba(255,255,255,0.06)' }}>
                              {stripHtml(email.analysis?.draft_body || email.body || '')}
                            </div>
                          </div>
                        )}
                        {email.analysis?.draft_response && (
                          <div>
                            <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--tc-25)' }}>Sophia's draft</p>
                            <div className="rounded-xl p-3 max-h-40 overflow-auto text-xs leading-relaxed whitespace-pre-wrap"
                              style={{ color: 'var(--tc-60)', background: `${B}08`, border: `1px solid ${B}20` }}>
                              {email.analysis.draft_response}
                            </div>
                          </div>
                        )}
                        {isPending && (
                          <div className="flex gap-2 pt-1">
                            {email.status === 'auto_pending' && (
                              <button onClick={() => handleHold(email)} disabled={processing === email.id}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                                style={{ color: 'var(--tc-70)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                Hold — move to approval
                              </button>
                            )}
                            {email.status === 'awaiting_approval' && (
                              <>
                                <button onClick={() => handleAction(email, 'approved')} disabled={processing === email.id}
                                  className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all text-white"
                                  style={{ background: B, boxShadow: `0 0 16px ${B}50` }}>
                                  Approve
                                </button>
                                <button onClick={() => handleAction(email, 'rejected')} disabled={processing === email.id}
                                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                                  style={{ color: 'var(--tc-60)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── History tab ── */}
      {tab === 'history' && (
        loading
          ? <div className="flex justify-center py-12"><div className="h-5 w-5 rounded-full border-2 animate-spin" style={{ borderColor: B, borderTopColor: 'transparent' }} /></div>
          : history.length === 0
            ? (
              <div style={cardStyle} className="p-12 text-center">
                <Send className="h-8 w-8 mx-auto mb-3" style={{ color: `${B}40` }} />
                <p className="text-sm" style={{ color: 'var(--tc-25)' }}>No email history yet</p>
              </div>
            )
            : (
              <div className="space-y-2">
                {history.map(email => (
                  <div key={email.id} style={cardStyle} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                            style={email.status === 'approved' || email.status === 'sent'
                              ? { background: `${B}20`, color: B, border: `1px solid ${B}30` }
                              : { background: 'rgba(255,255,255,0.06)', color: 'var(--tc-40)', border: '1px solid var(--s-pill-b)' }}>
                            {email.status === 'approved' || email.status === 'sent' ? 'Sent' : 'Rejected'}
                          </span>
                          {email.client && (
                            <span className="text-[10px] capitalize" style={{ color: 'var(--tc-35)' }}>
                              {email.client.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm truncate" style={{ color: 'var(--tc-75)' }}>{email.subject}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--tc-30)' }}>{email.to_email}</p>
                      </div>
                      <span className="text-[10px] shrink-0" style={{ color: 'var(--tc-25)' }}>{timeSince(email.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
      )}

    </div>
  );
}
