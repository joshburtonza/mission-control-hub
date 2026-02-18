import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle, XCircle, Clock, Mail } from 'lucide-react';

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

const clientLabels: Record<string, { label: string; color: string }> = {
  ascend_lc:          { label: 'Ascend LC',          color: 'bg-cyan-900/40 text-cyan-300 border-cyan-700/40' },
  favorite_logistics: { label: 'Favorite Logistics',  color: 'bg-green-900/40 text-green-300 border-green-700/40' },
  race_technik:       { label: 'Race Technik',        color: 'bg-purple-900/40 text-purple-300 border-purple-700/40' },
};

export default function Approvals() {
  const [pending, setPending] = useState<EmailItem[]>([]);
  const [history, setHistory] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('approvals_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_queue' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    const [pendingRes, historyRes] = await Promise.all([
      supabase.from('email_queue').select('*').eq('status', 'awaiting_approval').order('created_at', { ascending: false }),
      supabase.from('email_queue').select('*').in('status', ['approved', 'rejected']).order('created_at', { ascending: false }).limit(20),
    ]);
    if (!pendingRes.error) setPending((pendingRes.data as EmailItem[]) || []);
    if (!historyRes.error) setHistory((historyRes.data as EmailItem[]) || []);
    setLoading(false);
  };

  const handleAction = async (email: EmailItem, action: 'approved' | 'rejected') => {
    setProcessing(email.id);
    try {
      await supabase.from('email_queue').update({ status: action }).eq('id', email.id);
      await supabase.from('approvals').insert({
        email_queue_id: email.id,
        approval_type: 'escalation_response',
        request_body: `${action} — ${email.from_email}: ${email.subject}`,
        status: action,
        approved_by: 'Josh',
      });
      await supabase.from('audit_log').insert({
        agent: 'Sophia CSM',
        action: `email_${action}`,
        details: { email_id: email.id, from: email.from_email, subject: email.subject, client: email.client },
        status: 'success',
      });
      toast.success(action === 'approved'
        ? 'Approved — Sophia will send the response'
        : 'Rejected — response is held');
    } catch {
      toast.error('Failed to process — try again');
    } finally {
      setProcessing(null);
    }
  };

  const timeSince = (ts: string | null) => {
    if (!ts) return '—';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  const EmailCard = ({ email, showActions }: { email: EmailItem; showActions: boolean }) => {
    const cc = clientLabels[email.client || ''];
    const analysis = typeof email.analysis === 'object' ? email.analysis : null;
    return (
      <Card className={`bg-card ${showActions ? 'border-orange-600/40' : 'border-border/30'}`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {showActions && (
                  <Badge className="bg-orange-900/60 text-orange-300 border-orange-600/40 border text-[9px] font-mono">
                    <AlertTriangle className="h-2.5 w-2.5 mr-1" />ESCALATION
                  </Badge>
                )}
                {cc && <Badge className={`${cc.color} border text-[9px] font-mono`}>{cc.label}</Badge>}
                {!showActions && (
                  <Badge className={`border text-[9px] font-mono ${email.status === 'approved' ? 'bg-green-900/40 text-green-300 border-green-700/40' : 'bg-red-900/40 text-red-300 border-red-700/40'}`}>
                    {email.status === 'approved' ? 'Approved' : 'Rejected'}
                  </Badge>
                )}
              </div>
              <p className="font-mono text-xs text-foreground font-medium">{email.subject}</p>
              <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                <Mail className="h-2.5 w-2.5 inline mr-1" />{email.from_email}
              </p>
            </div>
            <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground shrink-0">
              <Clock className="h-2.5 w-2.5" />{timeSince(email.created_at)}
            </div>
          </div>
          {email.body && (
            <div>
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Email</p>
              <ScrollArea className="h-16 bg-secondary/20 rounded p-2">
                <p className="text-[10px] font-mono text-foreground/70 whitespace-pre-wrap">{email.body}</p>
              </ScrollArea>
            </div>
          )}
          {analysis && (
            <div className="bg-secondary/30 rounded p-2.5 space-y-1">
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Sophia's Read</p>
              {analysis.reason && <p className="text-[10px] font-mono text-orange-300">Reason: {analysis.reason}</p>}
              {analysis.draft_response && (
                <>
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mt-2">Draft Response</p>
                  <ScrollArea className="h-16">
                    <p className="text-[10px] font-mono text-foreground/70 whitespace-pre-wrap">{analysis.draft_response}</p>
                  </ScrollArea>
                </>
              )}
            </div>
          )}
          {showActions && (
            <div className="flex gap-2 pt-1">
              <Button onClick={() => handleAction(email, 'approved')} disabled={processing === email.id}
                className="flex-1 bg-green-900 hover:bg-green-800 text-green-200 border border-green-700/50 font-mono text-xs h-8">
                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />Approve
              </Button>
              <Button onClick={() => handleAction(email, 'rejected')} disabled={processing === email.id}
                className="flex-1 bg-red-900 hover:bg-red-800 text-red-200 border border-red-700/50 font-mono text-xs h-8">
                <XCircle className="h-3.5 w-3.5 mr-1.5" />Reject
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold tracking-wider text-foreground glow-cyan flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-400" />Approvals
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">Sophia escalations waiting for your call</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-orange-600/30 rounded-md px-3 py-2">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Pending</p>
          <p className="font-display text-xl text-orange-400">{pending.length}</p>
        </div>
        <div className="bg-card border border-success/30 rounded-md px-3 py-2">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Approved</p>
          <p className="font-display text-xl text-success">{history.filter(e => e.status === 'approved').length}</p>
        </div>
        <div className="bg-card border border-destructive/30 rounded-md px-3 py-2">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Rejected</p>
          <p className="font-display text-xl text-destructive">{history.filter(e => e.status === 'rejected').length}</p>
        </div>
      </div>
      <div className="flex gap-2">
        {(['pending', 'history'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border transition-colors ${activeTab === tab ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border/40 text-muted-foreground hover:text-primary'}`}>
            {tab === 'pending' ? `Pending (${pending.length})` : `History (${history.length})`}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="font-mono text-xs text-muted-foreground animate-pulse py-12 text-center">Loading...</div>
      ) : activeTab === 'pending' ? (
        pending.length === 0 ? (
          <div className="border border-border/30 rounded-lg p-12 text-center">
            <CheckCircle className="h-8 w-8 text-success mx-auto mb-3" />
            <p className="font-mono text-sm text-muted-foreground">Nothing pending — Sophia's got it</p>
          </div>
        ) : (
          <div className="space-y-4">{pending.map(e => <EmailCard key={e.id} email={e} showActions={true} />)}</div>
        )
      ) : history.length === 0 ? (
        <div className="border border-border/30 rounded-lg p-12 text-center">
          <p className="font-mono text-sm text-muted-foreground">No history yet</p>
        </div>
      ) : (
        <div className="space-y-3">{history.map(e => <EmailCard key={e.id} email={e} showActions={false} />)}</div>
      )}
    </div>
  );
}
