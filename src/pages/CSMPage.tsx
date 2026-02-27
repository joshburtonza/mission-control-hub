import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, Users, Mail, Clock, TrendingUp, MessageSquare, Send } from 'lucide-react';
import { SwipeableCard } from '@/components/ui/swipeable-card';

/* ── Types ── */
interface EmailItem {
  id: string; from_email: string; subject: string; client: string | null;
  status: string | null; created_at: string | null; body: string | null;
  analysis: any; requires_approval: boolean | null; to_email: string;
  scheduled_send_at: string | null;
}

interface ClientHealth {
  client: string;
  pending: number;
  sentToday: number;
  lastActivity: string | null;
  totalSent: number;
}

const B = '#4B9EFF';
const card = {
  background: 'var(--s-card)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid var(--s-card-b)',
  borderRadius: '20px',
  boxShadow: 'var(--s-card-shadow)',
} as React.CSSProperties;

function timeSince(ts: string | null) {
  if (!ts) return '';
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
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

/* ════════════════════════════════════════
   Client Health Tab
════════════════════════════════════════ */
function ClientHealthView({ allEmails }: { allEmails: EmailItem[] }) {
  const clientMap: Record<string, ClientHealth> = {};
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  allEmails.forEach(e => {
    const key = e.client || 'unknown';
    if (!clientMap[key]) clientMap[key] = { client: key, pending: 0, sentToday: 0, lastActivity: null, totalSent: 0 };
    const h = clientMap[key];
    if (e.status === 'awaiting_approval' || e.status === 'auto_pending') h.pending++;
    if (e.status === 'approved') {
      h.totalSent++;
      if (e.created_at && new Date(e.created_at) >= todayStart) h.sentToday++;
    }
    if (!h.lastActivity || (e.created_at && e.created_at > h.lastActivity)) {
      h.lastActivity = e.created_at;
    }
  });

  const clients = Object.values(clientMap).sort((a, b) => (b.pending - a.pending));

  if (clients.length === 0) {
    return (
      <div style={card} className="p-12 text-center">
        <Users className="h-8 w-8 mx-auto mb-3" style={{ color: `${B}40` }} />
        <p className="text-sm" style={{ color: 'var(--tc-25)' }}>No client activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {clients.map(c => (
        <div key={c.client} style={card} className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${B}15`, border: `1px solid ${B}25` }}>
                <Users className="h-4 w-4" style={{ color: B }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold capitalize" style={{ color: 'var(--tc-85)' }}>
                  {c.client.replace(/_/g, ' ')}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--tc-30)' }}>
                  {c.lastActivity ? `Last activity ${timeSince(c.lastActivity)}` : 'No activity'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              {c.pending > 0 && (
                <div className="text-right">
                  <p className="text-lg font-bold tabular-nums" style={{ color: B }}>{c.pending}</p>
                  <p className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--tc-25)' }}>Pending</p>
                </div>
              )}
              <div className="text-right">
                <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--tc-60)' }}>{c.totalSent}</p>
                <p className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--tc-25)' }}>Sent</p>
              </div>
              {c.sentToday > 0 && (
                <div className="text-right">
                  <p className="text-lg font-bold tabular-nums" style={{ color: '#4ADE80' }}>{c.sentToday}</p>
                  <p className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--tc-25)' }}>Today</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════
   Page
════════════════════════════════════════ */
export default function CSMPage() {
  const [pending, setPending]     = useState<EmailItem[]>([]);
  const [history, setHistory]     = useState<EmailItem[]>([]);
  const [all, setAll]             = useState<EmailItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [tab, setTab]             = useState<'queue' | 'history' | 'health'>('queue');
  const [queueTab, setQueueTab]   = useState<'pending' | 'history'>('pending');
  const [selected, setSelected]   = useState<EmailItem | null>(null);

  useEffect(() => {
    fetchData();
    const ch = supabase.channel('csm_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_queue' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchData = async () => {
    const [pRes, hRes, aRes] = await Promise.all([
      supabase.from('email_queue').select('*').in('status', ['awaiting_approval', 'auto_pending']).order('created_at', { ascending: false }),
      supabase.from('email_queue').select('*').in('status', ['approved', 'rejected']).order('created_at', { ascending: false }).limit(30),
      supabase.from('email_queue').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    if (!pRes.error) setPending((pRes.data as EmailItem[]) || []);
    if (!hRes.error) setHistory((hRes.data as EmailItem[]) || []);
    if (!aRes.error) setAll((aRes.data as EmailItem[]) || []);
    setLoading(false);
  };

  const handleAction = async (email: EmailItem, action: 'approved' | 'rejected') => {
    setProcessing(email.id);
    try {
      await supabase.from('email_queue').update({ status: action }).eq('id', email.id);
      await supabase.from('approvals').insert({ email_queue_id: email.id, approval_type: 'escalation_response', request_body: `${action} — ${email.from_email}: ${email.subject}`, status: action, approved_by: 'Josh' });
      await supabase.from('audit_log').insert({ agent: 'Sophia CSM', action: `email_${action}`, details: { email_id: email.id, from: email.from_email, subject: email.subject, client: email.client }, status: 'success' });
      toast.success(action === 'approved' ? 'Approved — Sophia will send' : 'Rejected — held');
      setSelected(null);
    } catch { toast.error('Failed to process'); }
    finally { setProcessing(null); }
  };

  const handleHold = async (email: EmailItem) => {
    setProcessing(email.id);
    try { await supabase.from('email_queue').update({ status: 'awaiting_approval' }).eq('id', email.id); toast.success('Held — moved to approval queue'); setSelected(null); }
    catch { toast.error('Failed to hold'); }
    finally { setProcessing(null); }
  };

  const queueList = queueTab === 'pending' ? pending : history;
  const totalSentAll = all.filter(e => e.status === 'approved').length;

  return (
    <div className="space-y-5">

      {/* ── Stats ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Pending',  value: pending.length,                               active: pending.length > 0 },
          { label: 'Approved', value: history.filter(e => e.status === 'approved').length, active: true },
          { label: 'Rejected', value: history.filter(e => e.status === 'rejected').length, active: false },
          { label: 'Total Sent', value: totalSentAll, active: true },
        ].map(s => (
          <div key={s.label} style={card} className="p-4">
            <p className="text-[9px] text-white/25 uppercase tracking-widest mb-2">{s.label}</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: s.active && s.value > 0 ? B : 'var(--tc-50)' }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Main tabs ── */}
      <div className="flex gap-2">
        {([
          { key: 'queue',  icon: MessageSquare, label: `Queue (${pending.length})` },
          { key: 'health', icon: TrendingUp,    label: 'Client Health' },
          { key: 'history',icon: Clock,         label: 'History' },
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
            <div style={card} className="p-12 text-center">
              <CheckCircle className="h-8 w-8 mx-auto mb-3" style={{ color: `${B}60` }} />
              <p className="text-sm" style={{ color: 'var(--tc-25)' }}>
                {queueTab === 'pending' ? "Queue is clear — Sophia's on it" : 'No history yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {queueList.map(email => {
                const isAuto     = email.status === 'auto_pending';
                const isApproved = email.status === 'approved';
                const isSelected = selected?.id === email.id;
                const isPending  = queueTab === 'pending';
                return (
                  <div key={email.id}>
                    <SwipeableCard
                      disabled={!isPending || !!processing}
                      onSwipeRight={() => {
                        if (email.status === 'awaiting_approval') handleAction(email, 'approved');
                        else if (email.status === 'auto_pending') handleAction(email, 'approved');
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
                        style={{ ...card, display: 'block', borderColor: isSelected ? `${B}40` : 'rgba(255,255,255,0.06)' }}>
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
                                  {email.status === 'awaiting_approval' && queueTab === 'pending' && (
                                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                                      style={{ color: 'var(--tc-50)', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--s-pill-b)' }}>
                                      ESCALATION
                                    </span>
                                  )}
                                  {queueTab === 'history' && (
                                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                                      style={isApproved
                                        ? { background: `${B}20`, color: B, border: `1px solid ${B}30` }
                                        : { background: 'rgba(255,255,255,0.06)', color: 'var(--tc-40)', border: '1px solid var(--s-pill-b)' }}>
                                      {email.status === 'approved' ? 'Approved' : 'Rejected'}
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
                        {email.body && (
                          <div>
                            <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--tc-25)' }}>Email body</p>
                            <div className="rounded-xl p-3 max-h-48 overflow-auto text-xs leading-relaxed whitespace-pre-wrap"
                              style={{ color: 'var(--tc-60)', background: 'var(--s-card)', border: '1px solid rgba(255,255,255,0.06)' }}>
                              {email.body}
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
                        {queueTab === 'pending' && (
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

      {/* ── Client Health tab ── */}
      {tab === 'health' && (
        loading
          ? <div className="flex justify-center py-12"><div className="h-5 w-5 rounded-full border-2 animate-spin" style={{ borderColor: B, borderTopColor: 'transparent' }} /></div>
          : <ClientHealthView allEmails={all} />
      )}

      {/* ── History tab ── */}
      {tab === 'history' && (
        loading
          ? <div className="flex justify-center py-12"><div className="h-5 w-5 rounded-full border-2 animate-spin" style={{ borderColor: B, borderTopColor: 'transparent' }} /></div>
          : history.length === 0
            ? <div style={card} className="p-12 text-center"><Send className="h-8 w-8 mx-auto mb-3" style={{ color: `${B}40` }} /><p className="text-sm" style={{ color: 'var(--tc-25)' }}>No email history yet</p></div>
            : (
              <div className="space-y-2">
                {history.map(email => (
                  <div key={email.id} style={card} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                            style={email.status === 'approved'
                              ? { background: `${B}20`, color: B, border: `1px solid ${B}30` }
                              : { background: 'rgba(255,255,255,0.06)', color: 'var(--tc-40)', border: '1px solid var(--s-pill-b)' }}>
                            {email.status === 'approved' ? 'Sent' : 'Rejected'}
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
