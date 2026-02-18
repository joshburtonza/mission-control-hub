import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:          { label: 'Pending',          color: 'bg-yellow-900/60 text-yellow-300 border-yellow-600/40',   icon: <Clock className="h-3 w-3" /> },
  analyzing:        { label: 'Analyzing',         color: 'bg-blue-900/60 text-blue-300 border-blue-600/40',         icon: <Eye className="h-3 w-3" /> },
  awaiting_approval:{ label: 'Needs Approval',    color: 'bg-orange-900/60 text-orange-300 border-orange-600/40',   icon: <AlertTriangle className="h-3 w-3" /> },
  approved:         { label: 'Approved',           color: 'bg-green-900/60 text-green-300 border-green-600/40',      icon: <CheckCircle className="h-3 w-3" /> },
  sent:             { label: 'Sent',               color: 'bg-cyan-900/60 text-cyan-300 border-cyan-600/40',         icon: <Send className="h-3 w-3" /> },
  rejected:         { label: 'Rejected',           color: 'bg-red-900/60 text-red-300 border-red-600/40',            icon: <XCircle className="h-3 w-3" /> },
  skipped:          { label: 'Skipped',            color: 'bg-gray-800/60 text-gray-400 border-gray-600/40',         icon: <XCircle className="h-3 w-3" /> },
};

const clientConfig: Record<string, { label: string; color: string }> = {
  ascend_lc:          { label: 'Ascend LC',          color: 'bg-cyan-900/40 text-cyan-300 border-cyan-700/40' },
  favorite_logistics: { label: 'Fav Logistics',       color: 'bg-green-900/40 text-green-300 border-green-700/40' },
  race_technik:       { label: 'Race Technik',        color: 'bg-purple-900/40 text-purple-300 border-purple-700/40' },
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchEmailQueue = async () => {
    const { data, error } = await supabase
      .from('email_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (!error) {
      setEmails((data as EmailItem[]) || []);
      // Keep selected email in sync
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
      // Update email status to approved
      const { error: emailErr } = await supabase
        .from('email_queue')
        .update({ status: 'approved' })
        .eq('id', email.id);

      if (emailErr) throw emailErr;

      // Create approval record
      await supabase.from('approvals').insert({
        email_queue_id: email.id,
        approval_type: 'routine_response',
        request_body: `Approved email from ${email.from_email}: ${email.subject}`,
        status: 'approved',
        approved_by: 'Josh',
      });

      // Write to audit log
      await supabase.from('audit_log').insert({
        agent: 'Sophia CSM',
        action: 'email_approved',
        details: { email_id: email.id, from: email.from_email, subject: email.subject, client: email.client },
        status: 'success',
      });

      toast.success('Email approved — Sophia will send the response');
      setSelectedEmail(null);
    } catch (err) {
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

      toast.info('Email rejected — Sophia will hold the response');
      setSelectedEmail(null);
    } catch (err) {
      toast.error('Failed to reject email');
    } finally {
      setApproving(null);
    }
  };

  const pendingApproval = emails.filter(e => e.status === 'awaiting_approval').length;
  const sentToday = emails.filter(e => e.status === 'sent').length;

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-orange-600/30 rounded-md px-3 py-2">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Needs Approval</p>
          <p className="font-display text-xl text-orange-400">{pendingApproval}</p>
        </div>
        <div className="bg-card border border-border/50 rounded-md px-3 py-2">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Total In Queue</p>
          <p className="font-display text-xl text-foreground">{emails.length}</p>
        </div>
        <div className="bg-card border border-cyan-600/30 rounded-md px-3 py-2">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Sent</p>
          <p className="font-display text-xl text-cyan-400">{sentToday}</p>
        </div>
      </div>

      <Card className="bg-card border-border/50 glow-box-cyan">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-display tracking-wide">Email Queue — Sophia CSM</CardTitle>
          </div>
          <CardDescription className="font-mono text-[10px] text-muted-foreground">
            Ascend LC · Favorite Logistics · Race Technik
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center text-muted-foreground font-mono text-xs py-8">Loading queue...</div>
          ) : (
            <ScrollArea className="h-72">
              <div className="space-y-1.5 pr-2">
                {emails.length === 0 ? (
                  <div className="text-center text-muted-foreground font-mono text-xs py-8">
                    No emails in queue — Sophia is watching
                  </div>
                ) : (
                  emails.map(email => {
                    const sc = statusConfig[email.status || 'pending'];
                    const cc = clientConfig[email.client || ''];
                    const isSelected = selectedEmail?.id === email.id;
                    return (
                      <div
                        key={email.id}
                        onClick={() => setSelectedEmail(isSelected ? null : email)}
                        className={`p-3 rounded-md border cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'border-primary/50 bg-secondary/80'
                            : 'border-border/40 bg-secondary/20 hover:border-primary/30 hover:bg-secondary/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono text-primary truncate">{email.from_email}</p>
                            <p className="text-[11px] text-foreground/70 truncate mt-0.5">{email.subject}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {cc && (
                              <Badge className={`${cc.color} border text-[9px] font-mono px-1.5 py-0`}>
                                {cc.label}
                              </Badge>
                            )}
                            {sc && (
                              <Badge className={`${sc.color} border text-[9px] font-mono px-1.5 py-0 flex items-center gap-1`}>
                                {sc.icon}
                                {sc.label}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {email.status === 'awaiting_approval' && (
                          <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(email)}
                              disabled={approving === email.id}
                              className="h-6 text-[10px] font-mono bg-green-900 hover:bg-green-800 text-green-200 border border-green-700/50"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleReject(email)}
                              disabled={approving === email.id}
                              className="h-6 text-[10px] font-mono bg-red-900 hover:bg-red-800 text-red-200 border border-red-700/50"
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
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {selectedEmail && (
        <Card className="bg-card border-primary/30 glow-box-cyan">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display tracking-wide text-primary">
              Email Detail
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">From</p>
                <p className="text-xs font-mono text-foreground mt-0.5">{selectedEmail.from_email}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">To</p>
                <p className="text-xs font-mono text-foreground mt-0.5">{selectedEmail.to_email}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Subject</p>
              <p className="text-xs font-mono text-foreground mt-0.5">{selectedEmail.subject}</p>
            </div>
            {selectedEmail.body && (
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Body</p>
                <ScrollArea className="h-24 mt-0.5">
                  <p className="text-xs text-foreground/80 font-mono whitespace-pre-wrap">{selectedEmail.body}</p>
                </ScrollArea>
              </div>
            )}
            {selectedEmail.analysis && (
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Sophia's Analysis</p>
                <ScrollArea className="h-24 mt-0.5">
                  <pre className="text-[10px] text-accent font-mono bg-secondary/50 p-2 rounded">
                    {JSON.stringify(selectedEmail.analysis, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            )}
            {selectedEmail.status === 'awaiting_approval' && (
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={() => handleApprove(selectedEmail)}
                  disabled={approving === selectedEmail.id}
                  className="flex-1 bg-green-900 hover:bg-green-800 text-green-200 border border-green-700/50 font-mono text-xs"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve — Send Response
                </Button>
                <Button
                  onClick={() => handleReject(selectedEmail)}
                  disabled={approving === selectedEmail.id}
                  className="flex-1 bg-red-900 hover:bg-red-800 text-red-200 border border-red-700/50 font-mono text-xs"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject — Hold Response
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
