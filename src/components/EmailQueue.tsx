import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, CheckCircle, XCircle, Clock, AlertTriangle, Send, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:           { label: 'Pending',       color: 'bg-warning/20 text-warning border-warning/30',       icon: <Clock className="h-3 w-3" /> },
  analyzing:         { label: 'Analyzing',     color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',    icon: <Eye className="h-3 w-3" /> },
  awaiting_approval: { label: 'Needs Approval',color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: <AlertTriangle className="h-3 w-3" /> },
  approved:          { label: 'Approved',      color: 'bg-success/20 text-success border-success/30',       icon: <CheckCircle className="h-3 w-3" /> },
  sent:              { label: 'Sent',          color: 'bg-primary/20 text-primary border-primary/30',       icon: <Send className="h-3 w-3" /> },
  rejected:          { label: 'Rejected',      color: 'bg-destructive/20 text-destructive border-destructive/30', icon: <XCircle className="h-3 w-3" /> },
  skipped:           { label: 'Skipped',       color: 'bg-muted/20 text-muted-foreground border-muted/30',  icon: <XCircle className="h-3 w-3" /> },
};

const clientColors: Record<string, string> = {
  ascend_lc:          'bg-blue-500/20 text-blue-300 border-blue-500/30',
  favorite_logistics: 'bg-success/20 text-success border-success/30',
  race_technik:       'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

const clientLabels: Record<string, string> = {
  ascend_lc:          'Ascend LC',
  favorite_logistics: 'Fav Logistics',
  race_technik:       'Race Technik',
};

export const EmailQueue: React.FC = () => {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  useEffect(() => {
    fetchEmailQueue();

    const channel = supabase
      .channel('email_queue_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_queue' }, () => {
        fetchEmailQueue();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchEmailQueue = async () => {
    const { data, error } = await supabase
      .from('email_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

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
      const { error: emailErr } = await supabase
        .from('email_queue')
        .update({ status: 'approved' })
        .eq('id', email.id);
      if (emailErr) throw emailErr;

      await supabase.from('approvals').insert({
        email_queue_id: email.id,
        approval_type: 'routine_response',
        request_body: `Approved email from ${email.from_email}: ${email.subject}`,
        status: 'approved',
        approved_by: 'Josh',
      });

      await supabase.from('audit_log').insert({
        agent: 'Sophia CSM',
        action: 'email_approved',
        details: { email_id: email.id, from: email.from_email, subject: email.subject, client: email.client },
        status: 'success',
      });

      toast.success('Email approved');
      setSelectedEmail(null);
    } catch {
      toast.error('Failed to approve email');
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (email: EmailItem) => {
    setApproving(email.id);
    try {
      const { error: emailErr } = await supabase
        .from('email_queue')
        .update({ status: 'rejected' })
        .eq('id', email.id);
      if (emailErr) throw emailErr;

      await supabase.from('approvals').insert({
        email_queue_id: email.id,
        approval_type: 'routine_response',
        request_body: `Rejected email from ${email.from_email}: ${email.subject}`,
        status: 'rejected',
        approved_by: 'Josh',
      });

      await supabase.from('audit_log').insert({
        agent: 'Sophia CSM',
        action: 'email_rejected',
        details: { email_id: email.id, from: email.from_email, subject: email.subject, client: email.client },
        status: 'success',
      });

      toast.info('Email rejected');
      setSelectedEmail(null);
    } catch {
      toast.error('Failed to reject email');
    } finally {
      setApproving(null);
    }
  };

  const pendingApproval = emails.filter(e => e.status === 'awaiting_approval').length;
  const sentCount = emails.filter(e => e.status === 'sent').length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {[
          { label: 'Needs Approval', value: pendingApproval, color: 'text-orange-400' },
          { label: 'In Queue', value: emails.length, color: 'text-card-foreground' },
          { label: 'Sent', value: sentCount, color: 'text-primary' },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-card px-3 md:px-4 py-3">
            <p className="text-[9px] md:text-[10px] text-card-foreground/40 uppercase tracking-wider">{s.label}</p>
            <p className={cn("text-xl md:text-2xl font-bold mt-0.5", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Queue list */}
      <div className="rounded-2xl bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-card-foreground">Email Queue — Sophia CSM</h3>
        </div>

        {loading ? (
          <p className="text-xs text-card-foreground/40 text-center py-8">Loading queue...</p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-auto dark-scrollbar">
            {emails.length === 0 ? (
              <p className="text-xs text-card-foreground/40 text-center py-8">
                No emails in queue
              </p>
            ) : (
              emails.map(email => {
                const sc = statusConfig[email.status || 'pending'];
                const isSelected = selectedEmail?.id === email.id;
                return (
                  <div
                    key={email.id}
                    onClick={() => setSelectedEmail(isSelected ? null : email)}
                    className={cn(
                      "p-3 rounded-xl cursor-pointer transition-all",
                      isSelected
                        ? "bg-white/10 ring-1 ring-primary/40"
                        : "hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-start sm:items-center justify-between gap-2 flex-col sm:flex-row">
                      <div className="flex-1 min-w-0 w-full">
                        <p className="text-xs font-medium text-card-foreground truncate">{email.from_email}</p>
                        <p className="text-[11px] text-card-foreground/50 truncate mt-0.5">{email.subject}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {email.client && clientLabels[email.client] && (
                          <Badge className={cn("border text-[9px] px-1.5 py-0", clientColors[email.client])}>
                            {clientLabels[email.client]}
                          </Badge>
                        )}
                        {sc && (
                          <Badge className={cn("border text-[9px] px-1.5 py-0 flex items-center gap-1", sc.color)}>
                            {sc.icon}
                            {sc.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {email.status === 'awaiting_approval' && (
                      <div className="flex gap-2 mt-2.5" onClick={e => e.stopPropagation()}>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(email)}
                          disabled={approving === email.id}
                          className="h-7 text-[10px] font-medium bg-success/20 hover:bg-success/30 text-success border border-success/30 rounded-lg"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleReject(email)}
                          disabled={approving === email.id}
                          className="h-7 text-[10px] font-medium bg-destructive/20 hover:bg-destructive/30 text-destructive border border-destructive/30 rounded-lg"
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedEmail && (
        <div className="rounded-2xl bg-card p-5 ring-1 ring-primary/20">
          <h4 className="text-sm font-semibold text-primary mb-3">Email Detail</h4>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-card-foreground/40 uppercase tracking-wider">From</p>
                <p className="text-xs text-card-foreground mt-0.5">{selectedEmail.from_email}</p>
              </div>
              <div>
                <p className="text-[10px] text-card-foreground/40 uppercase tracking-wider">To</p>
                <p className="text-xs text-card-foreground mt-0.5">{selectedEmail.to_email}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-card-foreground/40 uppercase tracking-wider">Subject</p>
              <p className="text-xs text-card-foreground mt-0.5">{selectedEmail.subject}</p>
            </div>
            {selectedEmail.body && (
              <div>
                <p className="text-[10px] text-card-foreground/40 uppercase tracking-wider">Body</p>
                <p className="text-xs text-card-foreground/70 mt-0.5 max-h-24 overflow-auto dark-scrollbar whitespace-pre-wrap">
                  {selectedEmail.body}
                </p>
              </div>
            )}
            {selectedEmail.analysis && (
              <div>
                <p className="text-[10px] text-card-foreground/40 uppercase tracking-wider">Analysis</p>
                <pre className="text-[10px] text-primary/80 bg-white/5 p-2 rounded-lg mt-0.5 max-h-24 overflow-auto dark-scrollbar">
                  {JSON.stringify(selectedEmail.analysis, null, 2)}
                </pre>
              </div>
            )}
            {selectedEmail.status === 'awaiting_approval' && (
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={() => handleApprove(selectedEmail)}
                  disabled={approving === selectedEmail.id}
                  className="flex-1 bg-success/20 hover:bg-success/30 text-success border border-success/30 rounded-lg text-xs"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  onClick={() => handleReject(selectedEmail)}
                  disabled={approving === selectedEmail.id}
                  className="flex-1 bg-destructive/20 hover:bg-destructive/30 text-destructive border border-destructive/30 rounded-lg text-xs"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
