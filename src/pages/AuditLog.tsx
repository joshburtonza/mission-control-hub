import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  success: { color: 'bg-success/20 text-success border-success/30', icon: <CheckCircle2 className="h-3 w-3" /> },
  failure: { color: 'bg-destructive/20 text-destructive border-destructive/30', icon: <XCircle className="h-3 w-3" /> },
  pending: { color: 'bg-warning/20 text-warning border-warning/30', icon: <Clock className="h-3 w-3" /> },
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
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: entries.length, color: 'text-card-foreground' },
          { label: 'Success', value: successCount, color: 'text-success' },
          { label: 'Failed', value: failureCount, color: 'text-destructive' },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-card px-4 py-3">
            <p className="text-[10px] text-card-foreground/40 uppercase tracking-wider">{s.label}</p>
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-0 sm:min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by agent, action, status..."
            className="pl-9 h-9 rounded-xl bg-secondary border-0 text-sm placeholder:text-muted-foreground/50"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setAgentFilter(null)}
            className={cn(
              'h-8 px-3 rounded-lg text-xs font-medium transition-colors',
              agentFilter === null
                ? 'bg-card text-card-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            )}
          >
            All
          </button>
          {agents.map(agent => (
            <button
              key={agent}
              onClick={() => setAgentFilter(agentFilter === agent ? null : agent)}
              className={cn(
                'h-8 px-3 rounded-lg text-xs font-medium transition-colors',
                agentFilter === agent
                  ? 'bg-card text-card-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {agent}
            </button>
          ))}
        </div>
        <button
          onClick={fetchLog}
          className="h-8 w-8 rounded-lg bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center ml-auto transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Log entries */}
      <div className="rounded-2xl bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-card-foreground">
            Audit Trail — {filtered.length} entries
          </h3>
        </div>

        {loading ? (
          <p className="text-xs text-card-foreground/40 animate-pulse py-8 text-center">
            Loading audit log...
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-card-foreground/40 py-8 text-center">
            No entries match your filters
          </p>
        ) : (
          <div className="space-y-1 max-h-[500px] overflow-auto dark-scrollbar">
            {filtered.map(entry => {
              const sc = statusConfig[entry.status || 'pending'];
              const isExpanded = expanded === entry.id;
              return (
                <div
                  key={entry.id}
                  className="rounded-xl overflow-hidden"
                >
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : entry.id)}
                  >
                    <span className="text-[10px] text-card-foreground/30 tabular-nums shrink-0 hidden sm:inline w-28">
                      {entry.executed_at ? new Date(entry.executed_at).toLocaleString() : '—'}
                    </span>
                    <span className="text-[10px] text-primary shrink-0 w-20 sm:w-24 truncate font-medium">
                      [{entry.agent || '?'}]
                    </span>
                    <span className="text-xs text-card-foreground/60 flex-1 truncate">
                      {actionLabels[entry.action || ''] || entry.action}
                    </span>
                    {sc && (
                      <Badge className={cn('text-[9px] border flex items-center gap-1 shrink-0 rounded-lg', sc.color)}>
                        {sc.icon}
                        {entry.status}
                      </Badge>
                    )}
                    <span className="text-card-foreground/30 shrink-0">
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </span>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-3 bg-white/5 space-y-2">
                      {entry.error_message && (
                        <div className="mt-2">
                          <p className="text-[9px] text-card-foreground/30 uppercase tracking-wider">Error</p>
                          <p className="text-[10px] text-destructive mt-0.5">{entry.error_message}</p>
                        </div>
                      )}
                      {entry.duration_ms != null && (
                        <div className="mt-2">
                          <p className="text-[9px] text-card-foreground/30 uppercase tracking-wider">Duration</p>
                          <p className="text-[10px] text-card-foreground/60 mt-0.5">{entry.duration_ms}ms</p>
                        </div>
                      )}
                      {entry.details && (
                        <div className="mt-2">
                          <p className="text-[9px] text-card-foreground/30 uppercase tracking-wider">Details</p>
                          <pre className="text-[9px] text-primary/80 bg-white/5 p-2 rounded-lg mt-0.5 max-h-24 overflow-auto dark-scrollbar">
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
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="h-8 px-3 rounded-lg text-xs font-medium bg-white/5 text-card-foreground/50 hover:text-card-foreground disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-card-foreground/30">Page {page + 1}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={entries.length < PAGE_SIZE}
            className="h-8 px-3 rounded-lg text-xs font-medium bg-white/5 text-card-foreground/50 hover:text-card-foreground disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
