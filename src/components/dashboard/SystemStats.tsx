import React, { useState, useEffect } from 'react';
import { Bot, Zap, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtitle?: string;
  variant?: "dark" | "accent";
  loading?: boolean;
}

function StatCard({ icon, label, value, subtitle, variant = "dark", loading }: StatCardProps) {
  const isAccent = variant === "accent";

  return (
    <div
      className={`rounded-2xl p-5 flex flex-col gap-2 ${
        isAccent
          ? "bg-primary/20 border border-primary/30"
          : "bg-card text-card-foreground"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={isAccent ? "text-primary" : "text-card-foreground/60"}>{icon}</span>
        <span className={`text-sm font-medium ${isAccent ? "text-foreground" : "text-card-foreground/80"}`}>
          {label}
        </span>
      </div>

      <div className="flex items-end gap-2">
        <span className={`text-4xl font-bold tracking-tight ${isAccent ? "text-foreground" : "text-card-foreground"}`}>
          {loading ? "—" : value}
        </span>
        {subtitle && (
          <span className={`text-xs mb-1.5 ${isAccent ? "text-foreground/50" : "text-card-foreground/40"}`}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

export function SystemStats() {
  const [agentsOnline, setAgentsOnline] = useState(0);
  const [totalAgents, setTotalAgents] = useState(0);
  const [activeTasks, setActiveTasks] = useState(0);
  const [queuedTasks, setQueuedTasks] = useState(0);
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
      <StatCard
        icon={<Bot className="h-4 w-4" />}
        label="Agents Online"
        value={agentsOnline}
        subtitle={`/ ${totalAgents} total`}
        variant="dark"
        loading={loading}
      />
      <StatCard
        icon={<Zap className="h-4 w-4" />}
        label="Active Tasks"
        value={activeTasks}
        subtitle={queuedTasks > 0 ? `${queuedTasks} queued` : undefined}
        variant="dark"
        loading={loading}
      />
      <StatCard
        icon={<Mail className="h-4 w-4" />}
        label="Emails Pending"
        value={emailsPending}
        variant="accent"
        loading={loading}
      />
      <StatCard
        icon={<ShieldCheck className="h-4 w-4" />}
        label="Needs Approval"
        value={emailsNeedApproval}
        variant={emailsNeedApproval > 0 ? "accent" : "dark"}
        loading={loading}
      />
    </div>
  );
}
