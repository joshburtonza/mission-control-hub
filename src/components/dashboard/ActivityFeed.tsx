import { useState, useEffect } from 'react';
import { Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AuditEntry {
  id: string;
  agent: string | null;
  action: string | null;
  status: string | null;
  executed_at: string | null;
  details: any;
}

const B = '#4B9EFF';

const actionLabels: Record<string, string> = {
  email_approved:          'Email approved',
  email_rejected:          'Email rejected',
  kill_switch_activated:   'KILL SWITCH activated',
  kill_switch_deactivated: 'Kill switch deactivated',
  agent_status_changed:    'Agent status updated',
  email_sent:              'Email sent',
  email_analyzed:          'Email analyzed',
};

const glass = {
  background: 'var(--s-card)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid var(--s-card-b)',
  borderRadius: '20px',
  boxShadow: 'var(--s-card-shadow)',
} as React.CSSProperties;

export function ActivityFeed() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEntries();
    const channel = supabase.channel('activity_feed_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, fetchEntries)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchEntries = async () => {
    const { data, error } = await supabase
      .from('audit_log').select('*')
      .order('executed_at', { ascending: false }).limit(15);
    if (!error) setEntries(data || []);
    setLoading(false);
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={glass} className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4" style={{ color: B }} />
        <h3 className="text-sm font-semibold text-white/80">Live Activity</h3>
        {loading && <span className="text-[10px] text-white/25 animate-pulse ml-auto">Loading...</span>}
      </div>
      <div className="space-y-0.5 max-h-64 overflow-auto">
        {entries.length === 0 && !loading && (
          <p className="text-xs text-white/25 text-center py-6">No activity yet</p>
        )}
        {entries.map(entry => {
          const isSuccess = entry.status === 'success';
          const isFailure = entry.status === 'failure';
          return (
            <div key={entry.id}
              className="flex items-center gap-3 py-2 px-2 rounded-lg transition-colors hover:bg-white/[0.03]">
              <span className="text-[10px] text-white/25 tabular-nums shrink-0">
                {formatTime(entry.executed_at)}
              </span>
              <div className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{
                  background: isSuccess ? B : isFailure ? 'var(--tc-30)' : 'var(--tc-15)',
                  boxShadow: isSuccess ? `0 0 5px ${B}` : 'none',
                }} />
              <span className="text-[11px] font-medium shrink-0"
                style={{ color: isSuccess ? `${B}cc` : isFailure ? 'var(--tc-50)' : 'var(--tc-35)' }}>
                [{entry.agent || '?'}]
              </span>
              <span className="text-xs text-white/40 truncate">
                {actionLabels[entry.action || ''] || entry.action}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
