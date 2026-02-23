import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, CheckCircle, XCircle, Clock, AlertTriangle, Send, Eye } from 'lucide-react';

interface EmailItem {
  id: string;
  from_email: string;
  subject: string;
  client: string | null;
  status: string | null;
  created_at: string | null;
  body: string | null;
  analysis: any;
  requires_approval: boolean | null;
  to_email: string;
}

const B = '#4B9EFF';

const glass = {
  background: 'var(--s-card)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid var(--s-card-b)',
  borderRadius: '20px',
  boxShadow: 'var(--s-card-shadow)',
} as React.CSSProperties;

/* status → icon + label; colour is always blue or white/opacity */
const statusConfig: Record<string, { label: string; icon: React.ReactNode; active: boolean }> = {
  pending:           { label: 'Pending',       icon: <Clock className="h-3 w-3" />,         active: false },
  analyzing:         { label: 'Analyzing',     icon: <Eye className="h-3 w-3" />,           active: true  },
  awaiting_approval: { label: 'Needs Approval',icon: <AlertTriangle className="h-3 w-3" />, active: true  },
  approved:          { label: 'Approved',      icon: <CheckCircle className="h-3 w-3" />,   active: true  },
  sent:              { label: 'Sent',          icon: <Send className="h-3 w-3" />,          active: true  },
  rejected:          { label: 'Rejected',      icon: <XCircle className="h-3 w-3" />,       active: false },
  skipped:           { label: 'Skipped',       icon: <XCircle className="h-3 w-3" />,       active: false },
};

const clientLabels: Record<string, string> = {
  ascend_lc:          'Ascend LC',
  favorite_logistics: 'Fav Logistics',
  race_technik:       'Race Technik',
};

function StatusPill({ status }: { status: string | null }) {
  const sc = statusConfig[status || 'pending'] ?? statusConfig.pending;
  return (
    <span className="flex items-center gap-1 text-[9px] font-medium px-2 py-0.5 rounded-full"
      style={{
        background: sc.active ? `${B}15` : 'var(--s-hover)',
        color: sc.active ? `${B}cc` : 'var(--tc-30)',
        border: `1px solid ${sc.active ? `${B}30` : 'rgba(255,255,255,0.08)'}`,
      }}>
      {sc.icon}
      {sc.label}
    </span>
  );
}

function ClientPill({ client }: { client: string | null }) {
  if (!client || !clientLabels[client]) return null;
  return (
    <span className="text-[9px] font-medium px-2 py-0.5 rounded-full"
      style={{ background: `${B}10`, color: `${B}99`, border: `1px solid ${B}20` }}>
      {clientLabels[client]}
    </span>
  );
}

export const EmailQueue: React.FC = () => {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  useEffect(() => {
    fetchEmailQueue();
    const channel = supabase.channel('email_queue_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_queue' }, fetchEmailQueue)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchEmailQueue = async () => {
    const { data, error } = await supabase
      .from('email_queue').select('*')
      .order('created_at', { ascending: false }).limit(30);
    if (!error) {
      setEmails((data as EmailItem[]) || []);
      if (selectedEmail) {
        const updated = data?.find(e => e.id === selectedEmail.id);
        if (updated) setSelectedEmail(updated as EmailItem);
      }
    }
    setLoading(false);
  };

  const handleApprove = async (email: EmailItem) => {
    setApproving(email.id);
    try {
      await supabase.from('email_queue').update({ status: 'approved' }).eq('id', email.id);
      await supabase.from('approvals').insert({ email_queue_id: email.id, approval_type: 'routine_response', request_body: `Approved email from ${email.from_email}: ${email.subject}`, status: 'approved', approved_by: 'Josh' });
      await supabase.from('audit_log').insert({ agent: 'Sophia CSM', action: 'email_approved', details: { email_id: email.id, from: email.from_email, subject: email.subject, client: email.client }, status: 'success' });
      toast.success('Email approved');
      setSelectedEmail(null);
    } catch { toast.error('Failed to approve email'); }
    finally { setApproving(null); }
  };

  const handleReject = async (email: EmailItem) => {
    setApproving(email.id);
    try {
      await supabase.from('email_queue').update({ status: 'rejected' }).eq('id', email.id);
      await supabase.from('approvals').insert({ email_queue_id: email.id, approval_type: 'routine_response', request_body: `Rejected email from ${email.from_email}: ${email.subject}`, status: 'rejected', approved_by: 'Josh' });
      await supabase.from('audit_log').insert({ agent: 'Sophia CSM', action: 'email_rejected', details: { email_id: email.id, from: email.from_email, subject: email.subject, client: email.client }, status: 'success' });
      toast.info('Email rejected');
      setSelectedEmail(null);
    } catch { toast.error('Failed to reject email'); }
    finally { setApproving(null); }
  };

  const pendingApproval = emails.filter(e => e.status === 'awaiting_approval').length;
  const sentCount = emails.filter(e => e.status === 'sent').length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Needs Approval', value: pendingApproval, glow: pendingApproval > 0 },
          { label: 'In Queue',       value: emails.length,   glow: false },
          { label: 'Sent',           value: sentCount,       glow: sentCount > 0 },
        ].map(s => (
          <div key={s.label} style={{ ...glass, borderRadius: '14px' }} className="px-3 py-3">
            <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: 'var(--tc-25)' }}>{s.label}</p>
            <p className="text-2xl font-bold tabular-nums"
              style={{ color: s.glow ? B : 'var(--tc-70)', textShadow: s.glow ? `0 0 16px ${B}88` : 'none' }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Queue list */}
      <div style={glass} className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-4 w-4" style={{ color: B }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--tc-80)' }}>Email Queue — Sophia CSM</h3>
        </div>

        {loading ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--tc-25)' }}>Loading queue...</p>
        ) : emails.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--tc-25)' }}>No emails in queue</p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-auto">
            {emails.map(email => {
              const isSelected = selectedEmail?.id === email.id;
              const needsApproval = email.status === 'awaiting_approval';
              return (
                <div
                  key={email.id}
                  onClick={() => setSelectedEmail(isSelected ? null : email)}
                  className="p-3 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: isSelected ? `${B}10` : 'var(--s-row)',
                    border: `1px solid ${isSelected ? `${B}35` : 'var(--s-row-b)'}`,
                    boxShadow: isSelected ? `0 0 0 1px ${B}20` : 'none',
                  }}
                >
                  <div className="flex items-start sm:items-center justify-between gap-2 flex-col sm:flex-row">
                    <div className="flex-1 min-w-0 w-full">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--tc-70)' }}>{email.from_email}</p>
                      <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--tc-35)' }}>{email.subject}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <ClientPill client={email.client} />
                      <StatusPill status={email.status} />
                    </div>
                  </div>
                  {needsApproval && (
                    <div className="flex gap-2 mt-2.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleApprove(email)}
                        disabled={approving === email.id}
                        className="h-7 px-3 text-[10px] font-medium rounded-lg transition-all"
                        style={{ background: `${B}20`, color: B, border: `1px solid ${B}40` }}
                      >
                        <CheckCircle className="h-3 w-3 inline mr-1" />Approve
                      </button>
                      <button
                        onClick={() => handleReject(email)}
                        disabled={approving === email.id}
                        className="h-7 px-3 text-[10px] font-medium rounded-lg transition-all"
                        style={{ background: 'var(--s-hover)', color: 'var(--tc-40)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        <XCircle className="h-3 w-3 inline mr-1" />Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedEmail && (
        <div style={{ ...glass, boxShadow: `0 0 0 1px ${B}25, 0 8px 32px rgba(0,0,0,0.4)` }} className="p-5">
          <h4 className="text-sm font-semibold mb-3" style={{ color: B }}>Email Detail</h4>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--tc-25)' }}>From</p>
                <p className="text-xs" style={{ color: 'var(--tc-70)' }}>{selectedEmail.from_email}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--tc-25)' }}>To</p>
                <p className="text-xs" style={{ color: 'var(--tc-70)' }}>{selectedEmail.to_email}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--tc-25)' }}>Subject</p>
              <p className="text-xs" style={{ color: 'var(--tc-70)' }}>{selectedEmail.subject}</p>
            </div>
            {selectedEmail.body && (
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--tc-25)' }}>Body</p>
                <p className="text-xs max-h-24 overflow-auto whitespace-pre-wrap" style={{ color: 'var(--tc-50)' }}>{selectedEmail.body}</p>
              </div>
            )}
            {selectedEmail.analysis && (
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--tc-25)' }}>Analysis</p>
                <pre className="text-[10px] p-2 rounded-lg max-h-24 overflow-auto"
                  style={{ background: `${B}08`, color: `${B}99`, border: `1px solid ${B}18` }}>
                  {JSON.stringify(selectedEmail.analysis, null, 2)}
                </pre>
              </div>
            )}
            {selectedEmail.status === 'awaiting_approval' && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleApprove(selectedEmail)}
                  disabled={approving === selectedEmail.id}
                  className="flex-1 h-9 text-xs font-medium rounded-xl transition-all"
                  style={{ background: `${B}20`, color: B, border: `1px solid ${B}40`, boxShadow: `0 0 12px ${B}20` }}
                >
                  <CheckCircle className="h-4 w-4 inline mr-2" />Approve
                </button>
                <button
                  onClick={() => handleReject(selectedEmail)}
                  disabled={approving === selectedEmail.id}
                  className="flex-1 h-9 text-xs font-medium rounded-xl transition-all"
                  style={{ background: 'var(--s-hover)', color: 'var(--tc-50)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <XCircle className="h-4 w-4 inline mr-2" />Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
