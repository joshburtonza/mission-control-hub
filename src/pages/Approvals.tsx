import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle } from 'lucide-react';
import { SwipeableCard } from '@/components/ui/swipeable-card';

interface EmailItem {
  id: string; from_email: string; subject: string; client: string | null;
  status: string | null; created_at: string | null; body: string | null;
  analysis: any; requires_approval: boolean | null; to_email: string;
  scheduled_send_at: string | null;
}

const B = '#4B9EFF';
const card = { background: 'var(--s-card)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid var(--s-card-b)', borderRadius: '20px', boxShadow: 'var(--s-card-shadow)' } as React.CSSProperties;

function timeSince(ts: string | null) {
  if (!ts) return '—';
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}
function timeUntil(ts: string | null) {
  if (!ts) return '~30m';
  const diff = new Date(ts).getTime() - Date.now();
  if (diff <= 0) return 'sending soon';
  const m = Math.ceil(diff / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function Approvals() {
  const [pending, setPending] = useState<EmailItem[]>([]);
  const [history, setHistory] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [selected, setSelected] = useState<EmailItem | null>(null);

  useEffect(() => {
    fetchData();
    const ch = supabase.channel('approvals_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_queue' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchData = async () => {
    const [pRes, hRes] = await Promise.all([
      supabase.from('email_queue').select('*').in('status', ['awaiting_approval', 'auto_pending']).order('created_at', { ascending: false }),
      supabase.from('email_queue').select('*').in('status', ['approved', 'rejected']).order('created_at', { ascending: false }).limit(20),
    ]);
    if (!pRes.error) setPending((pRes.data as EmailItem[]) || []);
    if (!hRes.error) setHistory((hRes.data as EmailItem[]) || []);
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

  const list = tab === 'pending' ? pending : history;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending',  value: pending.length,                               active: pending.length > 0 },
          { label: 'Approved', value: history.filter(e => e.status==='approved').length, active: true },
          { label: 'Rejected', value: history.filter(e => e.status==='rejected').length, active: false },
        ].map(s => (
          <div key={s.label} style={card} className="p-5">
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">{s.label}</p>
            <p className="text-3xl font-bold tabular-nums" style={{ color: s.active && s.value > 0 ? B : 'var(--tc-50)' }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['pending', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-xl text-xs font-medium transition-all"
            style={tab === t
              ? { background: `${B}20`, border: `1px solid ${B}40`, color: B }
              : { background: 'var(--s-hover)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--tc-40)' }}>
            {t === 'pending' ? `Pending (${pending.length})` : `History (${history.length})`}
          </button>
        ))}
      </div>

      {/* Swipe hint — mobile only, pending tab */}
      {tab === 'pending' && pending.length > 0 && (
        <p className="text-[10px] text-center sm:hidden" style={{ color: 'var(--tc-20)' }}>
          swipe right to approve · swipe left to reject
        </p>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 rounded-full border-2 animate-spin" style={{ borderColor: B, borderTopColor: 'transparent' }} />
        </div>
      ) : list.length === 0 ? (
        <div style={card} className="p-12 text-center">
          <CheckCircle className="h-8 w-8 mx-auto mb-3" style={{ color: `${B}60` }} />
          <p className="text-sm text-white/25">{tab === 'pending' ? "Nothing pending — Sophia's got it" : 'No history yet'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(email => {
            const isAuto = email.status === 'auto_pending';
            const isApproved = email.status === 'approved';
            const isSelected = selected?.id === email.id;
            const isPending = tab === 'pending';
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
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded" style={{ background: `${B}20`, color: B, border: `1px solid ${B}30` }}>
                                AUTO-SEND {timeUntil(email.scheduled_send_at)}
                              </span>
                            )}
                            {email.status === 'awaiting_approval' && tab === 'pending' && (
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded" style={{ color: 'var(--tc-50)', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--s-pill-b)' }}>
                                ESCALATION
                              </span>
                            )}
                            {tab === 'history' && (
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                                style={isApproved
                                  ? { background: `${B}20`, color: B, border: `1px solid ${B}30` }
                                  : { background: 'rgba(255,255,255,0.06)', color: 'var(--tc-40)', border: '1px solid var(--s-pill-b)' }}>
                                {email.status === 'approved' ? 'Approved' : 'Rejected'}
                              </span>
                            )}
                          </div>
                          <p className="text-sm truncate" style={{ color: 'var(--tc-80)' }}>{email.subject}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--tc-30)' }}>{email.from_email} · {email.client?.replace('_', ' ')}</p>
                        </div>
                      </div>
                      <span className="text-[10px] shrink-0" style={{ color: 'var(--tc-25)' }}>{timeSince(email.created_at)}</span>
                    </div>
                  </div>
                </button>

                </SwipeableCard>

                {/* Expanded detail */}
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
                    {tab === 'pending' && (
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
    </div>
  );
}
