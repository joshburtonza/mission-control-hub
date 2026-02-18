import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import {
  ClipboardList, CheckCircle2, XCircle, Clock, Search, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuditEntry {
  id: string;
  agent: string | null;
  action: string | null;
  details: any;
  status: string | null;
  executed_at: string | null;
  duration_ms?: number | null;
  error_message?: string | null;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  success: { color: 'bg-success/10 text-success border-success/30', icon: <CheckCircle2 className="h-3 w-3" /> },
  failure: { color: 'bg-destructive/10 text-destructive border-destructive/30', icon: <XCircle className="h-3 w-3" /> },
  pending: { color: 'bg-warning/10 text-warning border-warning/30', icon: <Clock className="h-3 w-3" /> },
};

const actionLabels: Record<string, string> = {
  email_approved:         'Email Approved',
  email_rejected:         'Email Rejected',
  kill_switch_activated:  'Kill Switch — STOP',
  kill_switch_deactivated:'Kill Switch — Resume',
  agent_status_changed:   'Agent Status Changed',
  email_sent:             'Email Sent',
  email_analyzed:         'Email Analyzed',
};

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    fetchLog();
    const channel = supabase
      .channel('audit_log_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, fetchLog)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [page]);

  const fetchLog = async () => {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('executed_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (!error) setEntries(data || []);
    setLoading(false);
  };

  const agents = Array.from(new Set(entries.map(e => e.agent).filter(Boolean))) as string[];

  const filtered = entries.filter(e => {
    const matchText = filter === '' || [e.agent, e.action, e.status].some(
      f => f?.toLowerCase().includes(filter.toLowerCase())
    );
    const matchAgent = agentFilter === null || e.agent === agentFilter;
    return matchText && matchAgent;
  });

  const successCount = entries.filter(e => e.status === 'success').length;
  const failureCount = entries.filter(e => e.status === 'failure').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold tracking-wider text-foreground glow-cyan">Audit Log</h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Full decision and action history · {entries.length} entries loaded
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border/50 rounded-md px-3 py-2">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
          <p className="font-display text-xl text-foreground">{entries.length}</p>
        </div>
        <div className="bg-card border border-success/30 rounded-md px-3 py-2">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Success</p>
          <p className="font-display text-xl text-success">{successCount}</p>
        </div>
        <div className="bg-card border border-destructive/30 rounded-md px-3 py-2">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Failed</p>
          <p className="font-display text-xl text-destructive">{failureCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by agent, action, status..."
            className="pl-8 h-8 font-mono text-xs bg-secondary/30 border-border/50"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Button
            size="sm"
            onClick={() => setAgentFilter(null)}
            className={cn(
              'h-7 text-[10px] font-mono',
              agentFilter === null
                ? 'bg-primary/20 text-primary border border-primary/40'
                : 'bg-transparent text-muted-foreground border border-border/40 hover:text-primary'
            )}
          >
            All
          </Button>
          {agents.map(agent => (
            <Button
              key={agent}
              size="sm"
              onClick={() => setAgentFilter(agentFilter === agent ? null : agent)}
              className={cn(
                'h-7 text-[10px] font-mono',
                agentFilter === agent
                  ? 'bg-primary/20 text-primary border border-primary/40'
                  : 'bg-transparent text-muted-foreground border border-border/40 hover:text-primary'
              )}
            >
              {agent}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchLog}
          className="h-7 w-7 p-0 border-border/40 text-muted-foreground hover:text-primary ml-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-display tracking-wide">
              Audit Trail — {filtered.length} entries
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="font-mono text-xs text-muted-foreground animate-pulse py-8 text-center">
              Loading audit log...
            </div>
          ) : filtered.length === 0 ? (
            <div className="font-mono text-xs text-muted-foreground py-8 text-center">
              No entries match your filters
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-1 pr-2">
                {filtered.map(entry => {
                  const sc = statusConfig[entry.status || 'pending'];
                  const isExpanded = expanded === entry.id;
                  return (
                    <div
                      key={entry.id}
                      className="rounded border border-border/30 bg-secondary/10 overflow-hidden"
                    >
                      <div
                        className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-secondary/30 transition-colors"
                        onClick={() => setExpanded(isExpanded ? null : entry.id)}
                      >
                        {/* Timestamp */}
                        <span className="font-mono text-[9px] text-muted-foreground tabular-nums shrink-0 w-28">
                          {entry.executed_at ? new Date(entry.executed_at).toLocaleString() : '—'}
                        </span>
                        {/* Agent */}
                        <span className="font-mono text-[10px] text-primary shrink-0 w-24 truncate">
                          [{entry.agent || '?'}]
                        </span>
                        {/* Action */}
                        <span className="font-mono text-xs text-foreground/80 flex-1 truncate">
                          {actionLabels[entry.action || ''] || entry.action}
                        </span>
                        {/* Status badge */}
                        {sc && (
                          <Badge className={cn('text-[9px] font-mono border flex items-center gap-1 shrink-0', sc.color)}>
                            {sc.icon}
                            {entry.status}
                          </Badge>
                        )}
                        {/* Expand icon */}
                        <span className="text-muted-foreground shrink-0">
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </span>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-3 border-t border-border/20 bg-secondary/20 space-y-2">
                          {entry.error_message && (
                            <div className="mt-2">
                              <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">Error</p>
                              <p className="font-mono text-[10px] text-destructive mt-0.5">{entry.error_message}</p>
                            </div>
                          )}
                          {entry.duration_ms != null && (
                            <div className="mt-2">
                              <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">Duration</p>
                              <p className="font-mono text-[10px] text-foreground/70 mt-0.5">{entry.duration_ms}ms</p>
                            </div>
                          )}
                          {entry.details && (
                            <div className="mt-2">
                              <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">Details</p>
                              <pre className="font-mono text-[9px] text-accent bg-secondary/50 p-2 rounded mt-0.5 max-h-24 overflow-auto">
                                {JSON.stringify(entry.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="h-7 text-[10px] font-mono border-border/40 text-muted-foreground"
            >
              Previous
            </Button>
            <span className="font-mono text-[10px] text-muted-foreground">Page {page + 1}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(p => p + 1)}
              disabled={entries.length < PAGE_SIZE}
              className="h-7 text-[10px] font-mono border-border/40 text-muted-foreground"
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
