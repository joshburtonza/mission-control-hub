import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, Clock, Activity, Zap, RefreshCw, Bot } from 'lucide-react';

const B = '#4B9EFF';

const glass = {
  background: 'var(--s-card)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid var(--s-card-b)',
  borderRadius: '20px',
  boxShadow: 'var(--s-card-shadow)',
} as React.CSSProperties;

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

interface KillSwitchData { id: string; status: string | null; triggered_by: string | null; triggered_at: string | null; reason: string | null; }
interface AgentRow { id: string; name: string; role: string; status: string | null; current_task: string | null; last_activity: string | null; }
interface CronLastRun { action: string; executed_at: string | null; status: string | null; }

export default function StatusPage() {
  const [killSwitch, setKillSwitch] = useState<KillSwitchData | null>(null);
  const [agents, setAgents]         = useState<AgentRow[]>([]);
  const [cronRuns, setCronRuns]     = useState<Record<string, CronLastRun>>({});
  const [loading, setLoading]       = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    const channel = supabase.channel('status_page_live')
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
  const cronOk     = CRON_JOBS.filter(j => cronRuns[j.action]?.status === 'success').length;
  const cronFailed = CRON_JOBS.filter(j => cronRuns[j.action]?.status === 'failure').length;

  return (
    <div className="space-y-5">

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'System',       value: isRunning ? 'GO' : 'STOP', glow: isRunning, small: false },
          { label: 'Agents',       value: `${onlineAgents}/${agents.length}`, glow: onlineAgents > 0, small: false },
          { label: 'Crons OK',     value: cronOk,     glow: cronOk > 0,     small: false },
          { label: 'Crons Failed', value: cronFailed, glow: false,          small: false },
        ].map(s => (
          <div key={s.label} style={{ ...glass, borderRadius: '14px' }} className="px-3 py-3">
            <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: 'var(--tc-25)' }}>{s.label}</p>
            <p className="text-2xl font-bold tabular-nums"
              style={{ color: s.glow ? B : 'var(--tc-60)', textShadow: s.glow ? `0 0 16px ${B}88` : 'none' }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Kill Switch status */}
      <div style={glass} className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4" style={{ color: isRunning ? B : 'var(--tc-60)' }} />
          <h3 className="text-sm font-semibold text-white/80">Kill Switch</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{
              background: isRunning ? B : 'var(--tc-60)',
              boxShadow: isRunning ? `0 0 8px ${B}` : '0 0 6px rgba(255,255,255,0.4)',
              animation: isRunning ? 'pulse 2s infinite' : undefined,
            }} />
          <span className="text-sm font-bold"
            style={{ color: isRunning ? B : 'var(--tc-70)' }}>
            {isRunning ? 'RUNNING — All systems go' : 'STOPPED — Automation paused'}
          </span>
        </div>
        {killSwitch?.triggered_at && (
          <p className="text-[10px] mt-2" style={{ color: 'var(--tc-25)' }}>
            Last updated {timeSince(killSwitch.triggered_at)}
            {killSwitch.triggered_by ? ` by ${killSwitch.triggered_by}` : ''}
            {killSwitch.reason ? ` · ${killSwitch.reason}` : ''}
          </p>
        )}
      </div>

      {/* Agents */}
      <div style={glass} className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-4 w-4" style={{ color: B }} />
          <h3 className="text-sm font-semibold text-white/80">Agents</h3>
        </div>
        {agents.length === 0 ? (
          <p className="text-xs text-white/25 text-center py-4">No agents registered yet</p>
        ) : (
          <div className="space-y-1.5">
            {agents.map(agent => {
              const isOnline = agent.status === 'online';
              const isIdle   = agent.status === 'idle';
              return (
                <div key={agent.id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--s-row)', border: '1px solid var(--s-row-b)' }}>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white/75">{agent.name}</p>
                    <p className="text-[9px] text-white/30 mt-0.5">{agent.role}</p>
                    {agent.current_task && (
                      <p className="text-[9px] text-white/35 mt-0.5 max-w-48 truncate">{agent.current_task}</p>
                    )}
                  </div>
                  <div className="text-right space-y-1 shrink-0 ml-3">
                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: isOnline ? `${B}15` : 'var(--s-hover)',
                        color: isOnline ? B : isIdle ? 'var(--tc-50)' : 'var(--tc-25)',
                        border: `1px solid ${isOnline ? `${B}30` : 'var(--s-pill-b)'}`,
                      }}>
                      {(agent.status || 'offline').toUpperCase()}
                    </span>
                    {agent.last_activity && (
                      <p className="text-[9px] text-white/25">{timeSince(agent.last_activity)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cron Jobs */}
      <div style={glass} className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" style={{ color: B }} />
            <h3 className="text-sm font-semibold text-white/80">Cron Jobs</h3>
          </div>
          <button onClick={fetchAll}
            className="h-7 w-7 flex items-center justify-center rounded-lg transition-all"
            style={{ background: 'var(--s-hover)', border: '1px solid var(--s-card-b)', color: 'var(--tc-30)' }}>
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
        {loading ? (
          <div className="text-xs text-white/25 animate-pulse py-4 text-center">Loading...</div>
        ) : (
          <div className="space-y-1.5">
            {CRON_JOBS.map(job => {
              const lastRun = cronRuns[job.action];
              const ok     = lastRun?.status === 'success';
              const failed = lastRun?.status === 'failure';
              return (
                <div key={job.id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--s-row)', border: '1px solid var(--s-row-b)' }}>
                  <div className="flex items-center gap-3">
                    {!lastRun ? (
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }} />
                    ) : ok ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: B }} />
                    ) : failed ? (
                      <XCircle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--tc-40)' }} />
                    ) : (
                      <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--tc-30)' }} />
                    )}
                    <div>
                      <p className="text-xs text-white/70">{job.name}</p>
                      <p className="text-[9px] text-white/30">{job.schedule}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {lastRun ? (
                      <>
                        <span className="text-[9px] font-medium px-2 py-0.5 rounded-full"
                          style={{
                            background: ok ? `${B}15` : 'var(--s-hover)',
                            color: ok ? B : failed ? 'var(--tc-45)' : 'var(--tc-35)',
                            border: `1px solid ${ok ? `${B}30` : 'var(--s-pill-b)'}`,
                          }}>
                          {ok ? 'OK' : failed ? 'FAILED' : (lastRun.status || '').toUpperCase()}
                        </span>
                        <p className="text-[9px] text-white/25 mt-0.5">{timeSince(lastRun.executed_at)}</p>
                      </>
                    ) : (
                      <span className="text-[9px] text-white/20">No runs yet</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[10px] text-white/20 text-right">
        Last refreshed {timeSince(lastRefresh.toISOString())}
        <button onClick={fetchAll} className="ml-2 hover:text-white/40 transition-colors">
          <RefreshCw className="h-2.5 w-2.5 inline" />
        </button>
      </p>
    </div>
  );
}
