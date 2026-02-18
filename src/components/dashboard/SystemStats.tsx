import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, MemoryStick, Zap, Mail, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface StatProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit: string;
  loading?: boolean;
}

function StatBlock({ icon, label, value, unit, loading }: StatProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-md bg-card border border-border/50">
      <div className="text-primary">{icon}</div>
      <div>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-lg font-display text-foreground">
          {loading ? (
            <span className="text-sm text-muted-foreground animate-pulse">—</span>
          ) : (
            <>
              {value}
              <span className="text-xs text-muted-foreground ml-1">{unit}</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export function SystemStats() {
  const [agentsOnline, setAgentsOnline] = useState(0);
  const [activeTasks, setActiveTasks] = useState(0);
  const [emailsPending, setEmailsPending] = useState(0);
  const [emailsNeedApproval, setEmailsNeedApproval] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();

    const channels = [
      supabase.channel('stats_agents')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, fetchStats)
        .subscribe(),
      supabase.channel('stats_tasks')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'task_queue' }, fetchStats)
        .subscribe(),
      supabase.channel('stats_emails')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'email_queue' }, fetchStats)
        .subscribe(),
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
      setAgentsOnline(agents.data.filter(a => a.status === 'online').length);
    }
    if (!tasks.error && tasks.data) {
      setActiveTasks(tasks.data.filter(t => t.status === 'executing').length);
    }
    if (!emails.error && emails.data) {
      setEmailsPending(emails.data.filter(e => e.status === 'pending' || e.status === 'analyzing').length);
      setEmailsNeedApproval(emails.data.filter(e => e.status === 'awaiting_approval').length);
    }

    setLoading(false);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatBlock
        icon={<Bot className="h-4 w-4" />}
        label="Agents Online"
        value={agentsOnline}
        unit=""
        loading={loading}
      />
      <StatBlock
        icon={<Zap className="h-4 w-4" />}
        label="Active Tasks"
        value={activeTasks}
        unit=""
        loading={loading}
      />
      <StatBlock
        icon={<Mail className="h-4 w-4" />}
        label="Emails Pending"
        value={emailsPending}
        unit=""
        loading={loading}
      />
      <StatBlock
        icon={<Cpu className="h-4 w-4" />}
        label="Needs Approval"
        value={emailsNeedApproval}
        unit=""
        loading={loading}
      />
    </div>
  );
}
