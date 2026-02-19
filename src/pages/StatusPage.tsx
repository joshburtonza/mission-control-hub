import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Clock, Activity, Zap, RefreshCw, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

const CRON_JOBS = [
  { id: 'sophia_polling',  name: 'Sophia CSM Polling',  schedule: 'Every 5min',        action: 'sophia_polling' },
  { id: 'email_scheduler', name: 'Email Scheduler',      schedule: 'Every 15min',       action: 'email_scheduler' },
  { id: 'daily_heartbeat', name: 'Daily Heartbeat',      schedule: 'Daily 12pm',        action: 'daily_heartbeat' },
  { id: 'video_scripts',   name: 'Video Scripts',        schedule: 'Daily 7am',         action: 'video_scripts' },
  { id: 'discord_engage',  name: 'Discord Engagement',   schedule: 'Daily 8am',         action: 'discord_engagement' },
  { id: 'cold_outreach',   name: 'Cold Outreach (Alex)', schedule: 'Daily 9am Mon-Fri', action: 'cold_outreach' },
  { id: 'repo_sync',       name: 'Repo Sync',            schedule: 'Tuesday 9am',       action: 'repo_sync' },
  { id: 'qmd_index',       name: 'QMD Auto-Index',       schedule: 'Daily 3am',         action: 'qmd_autoindex' },
  { id: 'memory_curate',   name: 'Memory Curation',      schedule: 'Sunday 6pm',        action: 'memory_curate' },
];

interface KillSwitchData {
  id: string;
  status: string | null;
  triggered_by: string | null;
  triggered_at: string | null;
  reason: string | null;
}

interface AgentRow {
  id: string;
  name: string;
  role: string;
  status: string | null;
  current_task: string | null;
  last_activity: string | null;
}

interface CronLastRun {
  action: string;
  executed_at: string | null;
  status: string | null;
}

const agentStatusColors: Record<string, string> = {
  online:  'text-success bg-success/10 border-success/30',
  idle:    'text-warning bg-warning/10 border-warning/30',
  offline: 'text-muted-foreground bg-secondary/30 border-border/30',
  error:   'text-destructive bg-destructive/10 border-destructive/30',
};

export default function StatusPage() {
  const [killSwitch, setKillSwitch] = useState<KillSwitchData | null>(null);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [cronRuns, setCronRuns] = useState<Record<string, CronLastRun>>({});
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    const channel = supabase
      .channel('status_page_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kill_switch' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, fetchAll)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, fetchAll)
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, []);

  const fetchAll = async () => {
    const [ksRes, agentRes, logRes] = await Promise.all([
      supabase.from('kill_switch').select('*').eq('id', '00000000-0000-0000-0000-000000000001').single(),
      supabase.from('agents').select('*').order('name'),
      supabase.from('audit_log').select('action, executed_at, status').order('executed_at', { ascending: false }).limit(300),
    ]);
    if (ksRes.data) setKillSwitch(ksRes.data);
    if (!agentRes.error && agentRes.data) setAgents(agentRes.data);
    if (logRes.data) {
      const runs: Record<string, CronLastRun> = {};
      for (const log of logRes.data) {
        if (log.action && !runs[log.action]) runs[log.action] = log;
      }
      setCronRuns(runs);
    }
    setLoading(false);
    setLastRefresh(new Date());
  };

  const timeSince = (ts: string | null) => {
    if (!ts) return 'Never';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const isRunning = killSwitch?.status === 'running';
  const onlineAgents = agents.filter(a => a.status === 'online').length;
  const cronOk = CRON_JOBS.filter(j => cronRuns[j.action]?.status === 'success').length;
  const cronFailed = CRON_JOBS.filter(j => cronRuns[j.action]?.status === 'failure').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-wider text-foreground glow-cyan flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            System Status
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Live health check · updated {timeSince(lastRefresh.toISOString())}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchAll}
          className="h-7 w-7 p-0 border-border/40 text-muted-foreground hover:text-primary">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`rounded-md border px-3 py-2 ${isRunning ? 'border-success/40 bg-success/5' : 'border-destructive/40 bg-destructive/5'}`}>
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">System</p>
          <p className={`font-display text-lg ${isRunning ? 'text-success' : 'text-destructive'}`}>
            {isRunning ? 'GO' : 'STOP'}
          </p>
        </div>
        <div className="rounded-md border border-border/50 bg-card px-3 py-2">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Agents</p>
          <p className="font-display text-lg text-foreground">{onlineAgents}/{agents.length}</p>
        </div>
        <div className="rounded-md border border-success/30 bg-card px-3 py-2">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Crons OK</p>
          <p className="font-display text-lg text-success">{cronOk}</p>
        </div>
        <div className="rounded-md border border-destructive/30 bg-card px-3 py-2">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Crons Failed</p>
          <p className="font-display text-lg text-destructive">{cronFailed}</p>
        </div>
      </div>

      {/* Kill Switch */}
      <Card className={`border ${isRunning ? 'border-success/40' : 'border-destructive/50'} bg-card`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display tracking-wide flex items-center gap-2">
            <Zap className={`h-4 w-4 ${isRunning ? 'text-success' : 'text-destructive'}`} />
            Kill Switch
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className={cn('h-3 w-3 rounded-full', isRunning ? 'bg-success animate-pulse' : 'bg-destructive')} />
            <span className={cn('font-mono text-sm font-bold', isRunning ? 'text-success' : 'text-destructive')}>
              {isRunning ? 'RUNNING — All systems go' : 'STOPPED — Automation paused'}
            </span>
          </div>
          {killSwitch?.triggered_at && (
            <p className="font-mono text-[10px] text-muted-foreground mt-2">
              Last updated {timeSince(killSwitch.triggered_at)}
              {killSwitch.triggered_by ? ` by ${killSwitch.triggered_by}` : ''}
              {killSwitch.reason ? ` · ${killSwitch.reason}` : ''}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Agents */}
      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display tracking-wide flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Agents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground text-center py-4">No agents registered yet</p>
          ) : (
            <div className="space-y-1.5">
              {agents.map(agent => {
                const sc = agentStatusColors[agent.status || 'offline'];
                return (
                  <div key={agent.id} className="flex items-center justify-between p-2.5 rounded border border-border/20 bg-secondary/10">
                    <div>
                      <p className="font-mono text-xs text-foreground">{agent.name}</p>
                      <p className="font-mono text-[9px] text-muted-foreground">{agent.role}</p>
                      {agent.current_task && (
                        <p className="font-mono text-[9px] text-foreground/50 mt-0.5 max-w-48 truncate">{agent.current_task}</p>
                      )}
                    </div>
                    <div className="text-right space-y-1">
                      <Badge className={cn('text-[9px] font-mono border', sc)}>
                        {(agent.status || 'offline').toUpperCase()}
                      </Badge>
                      {agent.last_activity && (
                        <p className="font-mono text-[9px] text-muted-foreground">{timeSince(agent.last_activity)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cron Jobs */}
      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display tracking-wide flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Cron Jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="font-mono text-xs text-muted-foreground animate-pulse py-4 text-center">Loading...</div>
          ) : (
            <div className="space-y-1.5">
              {CRON_JOBS.map(job => {
                const lastRun = cronRuns[job.action];
                const ok = lastRun?.status === 'success';
                const failed = lastRun?.status === 'failure';
                return (
                  <div key={job.id} className="flex items-center justify-between p-2.5 rounded border border-border/20 bg-secondary/10">
                    <div className="flex items-center gap-3">
                      {!lastRun ? (
                        <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30 shrink-0" />
                      ) : ok ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      ) : failed ? (
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-warning shrink-0" />
                      )}
                      <div>
                        <p className="font-mono text-xs text-foreground">{job.name}</p>
                        <p className="font-mono text-[9px] text-muted-foreground">{job.schedule}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {lastRun ? (
                        <>
                          <Badge className={cn('text-[9px] font-mono border', {
                            'bg-success/10 text-success border-success/30': ok,
                            'bg-destructive/10 text-destructive border-destructive/30': failed,
                            'bg-warning/10 text-warning border-warning/30': !ok && !failed,
                          })}>
                            {ok ? 'OK' : failed ? 'FAILED' : (lastRun.status || '').toUpperCase()}
                          </Badge>
                          <p className="font-mono text-[9px] text-muted-foreground mt-0.5">
                            {timeSince(lastRun.executed_at)}
                          </p>
                        </>
                      ) : (
                        <span className="font-mono text-[9px] text-muted-foreground">No runs yet</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
