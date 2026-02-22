import React, { useState, useEffect } from 'react';
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface AuditEntry {
  id: string;
  agent: string | null;
  action: string | null;
  status: string | null;
  executed_at: string | null;
  details: any;
}

const levelColors: Record<string, string> = {
  success: "text-success",
  failure: "text-destructive",
  pending: "text-warning",
};

const actionLabels: Record<string, string> = {
  email_approved:          'Email approved',
  email_rejected:          'Email rejected',
  kill_switch_activated:   'KILL SWITCH activated',
  kill_switch_deactivated: 'Kill switch deactivated',
  agent_status_changed:    'Agent status updated',
  email_sent:              'Email sent',
  email_analyzed:          'Email analyzed',
};

export function ActivityFeed() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEntries();

    const channel = supabase
      .channel('activity_feed_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, () => {
        fetchEntries();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchEntries = async () => {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('executed_at', { ascending: false })
      .limit(15);
    if (!error) setEntries(data || []);
    setLoading(false);
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="rounded-2xl bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-card-foreground">Live Activity</h3>
        {loading && (
          <span className="text-[10px] text-card-foreground/30 animate-pulse ml-auto">Loading...</span>
        )}
      </div>
      <div className="space-y-1 max-h-64 overflow-auto dark-scrollbar">
        {entries.length === 0 && !loading && (
          <p className="text-xs text-card-foreground/40 text-center py-6">
            No activity yet
          </p>
        )}
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <span className="text-[10px] text-card-foreground/30 tabular-nums shrink-0">
              {formatTime(entry.executed_at)}
            </span>
            <span className={cn("text-[10px] shrink-0 font-medium", levelColors[entry.status || 'pending'])}>
              [{entry.agent || '?'}]
            </span>
            <span className="text-xs text-card-foreground/60 truncate">
              {actionLabels[entry.action || ''] || entry.action}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
