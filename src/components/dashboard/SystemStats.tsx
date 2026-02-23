import { useState, useEffect } from 'react';
import { Bot, Zap, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const B = '#4B9EFF';

const glass = {
  background: 'var(--s-card)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid var(--s-card-b)',
  borderRadius: '20px',
  boxShadow: 'var(--s-card-shadow)',
} as React.CSSProperties;

function StatCard({ icon, label, value, subtitle, glow, loading }: {
  icon: React.ReactNode; label: string; value: number;
  subtitle?: string; glow?: boolean; loading?: boolean;
}) {
  return (
    <div style={glass} className="p-5 flex flex-col gap-2 relative overflow-hidden">
      {glow && (
        <div className="absolute -top-4 -right-4 h-16 w-16 rounded-full blur-2xl pointer-events-none"
          style={{ background: `${B}25` }} />
      )}
      <div className="flex items-center gap-2">
        <span style={{ color: glow ? B : 'var(--tc-40)' }}>{icon}</span>
        <span className="text-sm font-medium" style={{ color: 'var(--tc-70)' }}>{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold tracking-tight tabular-nums"
          style={{ color: glow ? B : 'var(--tc-85)', textShadow: glow ? `0 0 20px ${B}88` : 'none' }}>
          {loading ? '—' : value}
        </span>
        {subtitle && (
          <span className="text-xs mb-1.5" style={{ color: 'var(--tc-30)' }}>{subtitle}</span>
        )}
      </div>
    </div>
  );
}

export function SystemStats() {
  const [agentsOnline, setAgentsOnline]         = useState(0);
  const [totalAgents, setTotalAgents]           = useState(0);
  const [activeTasks, setActiveTasks]           = useState(0);
  const [queuedTasks, setQueuedTasks]           = useState(0);
  const [emailsPending, setEmailsPending]       = useState(0);
  const [emailsNeedApproval, setEmailsNeedApproval] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const channels = [
      supabase.channel('stats_agents').on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, fetchStats).subscribe(),
      supabase.channel('stats_tasks').on('postgres_changes', { event: '*', schema: 'public', table: 'task_queue' }, fetchStats).subscribe(),
      supabase.channel('stats_emails').on('postgres_changes', { event: '*', schema: 'public', table: 'email_queue' }, fetchStats).subscribe(),
    ];
    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, []);

  const fetchStats = async () => {
    const [agents, tasks, emails] = await Promise.all([
      supabase.from('agents').select('status'),
      supabase.from('task_queue').select('status').in('status', ['queued', 'executing']),
      supabase.from('email_queue').select('status').in('status', ['pending', 'analyzing', 'awaiting_approval']),
    ]);
    if (!agents.error && agents.data) {
      setTotalAgents(agents.data.length);
      setAgentsOnline(agents.data.filter(a => a.status === 'online').length);
    }
    if (!tasks.error && tasks.data) {
      setActiveTasks(tasks.data.filter(t => t.status === 'executing').length);
      setQueuedTasks(tasks.data.filter(t => t.status === 'queued').length);
    }
    if (!emails.error && emails.data) {
      setEmailsPending(emails.data.filter(e => e.status === 'pending' || e.status === 'analyzing').length);
      setEmailsNeedApproval(emails.data.filter(e => e.status === 'awaiting_approval').length);
    }
    setLoading(false);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard icon={<Bot className="h-4 w-4" />}       label="Agents Online"   value={agentsOnline}       subtitle={`/ ${totalAgents} total`}               glow={agentsOnline > 0}       loading={loading} />
      <StatCard icon={<Zap className="h-4 w-4" />}       label="Active Tasks"    value={activeTasks}        subtitle={queuedTasks > 0 ? `${queuedTasks} queued` : undefined} glow={activeTasks > 0}  loading={loading} />
      <StatCard icon={<Mail className="h-4 w-4" />}      label="Emails Pending"  value={emailsPending}                                                        glow={emailsPending > 0}      loading={loading} />
      <StatCard icon={<ShieldCheck className="h-4 w-4" />} label="Needs Approval" value={emailsNeedApproval}                                                   glow={emailsNeedApproval > 0} loading={loading} />
    </div>
  );
}
