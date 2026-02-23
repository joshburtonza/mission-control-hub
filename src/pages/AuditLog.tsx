import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Search, ChevronDown, ChevronUp, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuditEntry {
  id: string; agent: string | null; action: string | null; details: any;
  status: string | null; executed_at: string | null; duration_ms?: number | null; error_message?: string | null;
}

const B = '#4B9EFF';
const card = { background: 'var(--s-card)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid var(--s-card-b)', borderRadius: '20px', boxShadow: 'var(--s-card-shadow)' } as React.CSSProperties;

const actionLabels: Record<string, string> = {
  email_approved: 'Email Approved', email_rejected: 'Email Rejected',
  kill_switch_activated: 'Kill Switch — STOP', kill_switch_deactivated: 'Kill Switch — Resume',
  agent_status_changed: 'Agent Status Changed', email_sent: 'Email Sent', email_analyzed: 'Email Analyzed',
};

export default function AuditLog() {
  const [entries, setEntries]     = useState<AuditEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('');
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [page, setPage]           = useState(0);
  const PAGE = 50;

  useEffect(() => {
    fetchLog();
    const ch = supabase.channel('audit_live2').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, fetchLog).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [page]);

  const fetchLog = async () => {
    const { data } = await supabase.from('audit_log').select('*').order('executed_at', { ascending: false }).range(page*PAGE, (page+1)*PAGE-1);
    if (data) setEntries(data);
    setLoading(false);
  };

  const agents = [...new Set(entries.map(e => e.agent).filter(Boolean))] as string[];
  const filtered = entries.filter(e => {
    const t = filter === '' || [e.agent, e.action, e.status].some(f => f?.toLowerCase().includes(filter.toLowerCase()));
    const a = !agentFilter || e.agent === agentFilter;
    return t && a;
  });

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',   value: entries.length },
          { label: 'Success', value: entries.filter(e => e.status==='success').length, active: true },
          { label: 'Failed',  value: entries.filter(e => e.status==='failure').length },
        ].map(s => (
          <div key={s.label} style={card} className="p-5">
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">{s.label}</p>
            <p className="text-3xl font-bold tabular-nums" style={{ color: (s as any).active ? B : 'var(--tc-50)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-0 sm:min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-white/25" />
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter…"
            className="w-full pl-8 pr-3 py-2 rounded-xl text-xs text-white placeholder:text-white/20 focus:outline-none"
            style={{ background: 'var(--s-input)', border: '1px solid rgba(255,255,255,0.06)' }} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[{ label: 'All', val: null }, ...agents.map(a => ({ label: a.split(' ')[0], val: a }))].map(({ label, val }) => (
            <button key={label} onClick={() => setAgentFilter(val)}
              className="h-8 px-3 rounded-lg text-xs font-medium transition-colors"
              style={agentFilter === val
                ? { background: `${B}20`, color: B, border: `1px solid ${B}30` }
                : { background: 'var(--s-hover)', color: 'var(--tc-35)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={fetchLog} className="h-8 w-8 rounded-lg flex items-center justify-center text-white/25 hover:text-white/50 transition-colors ml-auto"
          style={{ background: 'var(--s-hover)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Log */}
      <div style={card} className="overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <p className="text-xs font-semibold text-white/60">Audit Trail — {filtered.length} entries</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-5 w-5 rounded-full border-2 animate-spin" style={{ borderColor: B, borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-white/20 py-10 text-center">No entries match</p>
        ) : (
          <div className="divide-y divide-white/[0.04] max-h-[500px] overflow-auto">
            {filtered.map(entry => {
              const isSuccess = entry.status === 'success';
              const isOpen = expanded === entry.id;
              return (
                <div key={entry.id}>
                  <div className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => setExpanded(isOpen ? null : entry.id)}>
                    <div className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: isSuccess ? B : 'rgba(255,255,255,0.15)', boxShadow: isSuccess ? `0 0 4px ${B}` : 'none' }} />
                    <span className="text-[10px] text-white/20 tabular-nums hidden sm:inline w-32 shrink-0">
                      {entry.executed_at ? new Date(entry.executed_at).toLocaleString() : '—'}
                    </span>
                    <span className="text-[10px] font-medium shrink-0 w-20 truncate" style={{ color: `${B}cc` }}>
                      {entry.agent?.split(' ')[0] || '?'}
                    </span>
                    <span className="text-xs text-white/50 flex-1 truncate">
                      {actionLabels[entry.action || ''] || entry.action}
                    </span>
                    <span className="text-white/20 shrink-0">
                      {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </span>
                  </div>
                  {isOpen && (
                    <div className="px-5 pb-3 pt-1 space-y-2" style={{ background: 'var(--s-hover)' }}>
                      {entry.error_message && <p className="text-[11px] text-white/40">{entry.error_message}</p>}
                      {entry.duration_ms != null && <p className="text-[10px] text-white/25">{entry.duration_ms}ms</p>}
                      {entry.details && (
                        <pre className="text-[9px] text-white/40 rounded-lg p-2 max-h-24 overflow-auto" style={{ background: 'var(--s-card)' }}>
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
          <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0}
            className="h-8 px-3 rounded-lg text-xs text-white/30 hover:text-white/60 disabled:opacity-20 transition-colors"
            style={{ background: 'var(--s-hover)' }}>Previous</button>
          <span className="text-[10px] text-white/20">Page {page+1}</span>
          <button onClick={() => setPage(p => p+1)} disabled={entries.length<PAGE}
            className="h-8 px-3 rounded-lg text-xs text-white/30 hover:text-white/60 disabled:opacity-20 transition-colors"
            style={{ background: 'var(--s-hover)' }}>Next</button>
        </div>
      </div>
    </div>
  );
}
