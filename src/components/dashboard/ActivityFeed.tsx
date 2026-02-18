import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  email_approved:          'Email approved — response queued',
  email_rejected:          'Email rejected — response held',
  kill_switch_activated:   'KILL SWITCH activated',
  kill_switch_deactivated: 'Kill switch deactivated — resuming',
  agent_status_changed:    'Agent status updated',
  email_sent:              'Email sent to client',
  email_analyzed:          'Email analyzed by Sophia',
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
      .limit(20);
    if (!error) setEntries(data || []);
    setLoading(false);
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <Card className="bg-card border-border/50 glow-box-cyan">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-display tracking-wide">Live Activity Feed</CardTitle>
          {loading && (
            <span className="font-mono text-[9px] text-muted-foreground animate-pulse ml-auto">Loading...</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-64">
          <div className="space-y-1">
            {entries.length === 0 && !loading && (
              <p className="font-mono text-xs text-muted-foreground text-center py-4">
                No activity yet — agents are standing by
              </p>
            )}
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 py-1.5 px-2 rounded hover:bg-secondary/50 transition-colors"
              >
                <span className="font-mono text-[10px] text-muted-foreground tabular-nums shrink-0 mt-0.5">
                  {formatTime(entry.executed_at)}
                </span>
                <span className={cn("font-mono text-[10px] shrink-0 w-20 mt-0.5 truncate", levelColors[entry.status || 'pending'])}>
                  [{entry.agent || '?'}]
                </span>
                <span className="font-mono text-xs text-foreground/70">
                  {actionLabels[entry.action || ''] || entry.action}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
