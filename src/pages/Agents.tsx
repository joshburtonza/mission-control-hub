import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Bot, Play, Pause, RotateCcw, Terminal, Activity, Cpu,
  CheckCircle2, AlertCircle, Clock, WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Agent {
  id: string;
  name: string;
  role: string;
  status: string | null;
  current_task: string | null;
  last_activity: string | null;
  created_at: string | null;
}

interface TaskItem {
  id: string;
  agent: string | null;
  task_type: string | null;
  status: string | null;
  payload: any;
  result: any;
  created_at: string | null;
}

const statusConfig: Record<string, { label: string; dot: string; text: string }> = {
  online:  { label: 'ONLINE',  dot: 'bg-success animate-pulse', text: 'text-success' },
  idle:    { label: 'IDLE',    dot: 'bg-warning animate-pulse',  text: 'text-warning' },
  offline: { label: 'OFFLINE', dot: 'bg-muted-foreground',       text: 'text-muted-foreground' },
  error:   { label: 'ERROR',   dot: 'bg-destructive animate-pulse', text: 'text-destructive' },
};

const roleLabels: Record<string, string> = {
  csm:        'Customer Success',
  outreach:   'Cold Outreach',
  automation: 'Automation',
  monitor:    'Monitor',
};

const agentDescriptions: Record<string, string> = {
  'Sophia CSM':    'Monitors 3 client inboxes, drafts warm SA responses, routes escalations',
  'Alex Outreach': 'Sends up to 300 cold outreach emails/month with smart warm-up schedule',
  'System Monitor':'Heartbeat checks every 30 mins, repo sync Tuesdays, cron job management',
};

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchData();

    const agentChannel = supabase
      .channel('agents_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, fetchData)
      .subscribe();

    const taskChannel = supabase
      .channel('task_queue_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_queue' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(agentChannel);
      supabase.removeChannel(taskChannel);
    };
  }, []);

  const fetchData = async () => {
    const [agentsRes, tasksRes] = await Promise.all([
      supabase.from('agents').select('*').order('created_at'),
      supabase.from('task_queue').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    if (!agentsRes.error) setAgents(agentsRes.data || []);
    if (!tasksRes.error) setTasks(tasksRes.data || []);
    setLoading(false);
  };

  const updateAgentStatus = async (agent: Agent, newStatus: string) => {
    setUpdating(agent.id);
    try {
      const { error } = await supabase
        .from('agents')
        .update({ status: newStatus, last_activity: new Date().toISOString() })
        .eq('id', agent.id);
      if (error) throw error;

      await supabase.from('audit_log').insert({
        agent: agent.name,
        action: 'agent_status_changed',
        details: { from: agent.status, to: newStatus },
        status: 'success',
      });

      toast.success(`${agent.name} → ${newStatus.toUpperCase()}`);
    } catch {
      toast.error('Failed to update agent status');
    } finally {
      setUpdating(null);
    }
  };

  const agentTasks = (agentName: string) =>
    tasks.filter(t => t.agent === agentName);

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="text-sm text-muted-foreground animate-pulse">Loading agents...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {agents.map(agent => {
            const sc = statusConfig[agent.status || 'offline'];
            const desc = agentDescriptions[agent.name];
            const agTasksActive = agentTasks(agent.name).filter(t => t.status === 'executing').length;
            const agTasksQueued = agentTasks(agent.name).filter(t => t.status === 'queued').length;
            const agTasksDone = agentTasks(agent.name).filter(t => t.status === 'completed').length;
            const isSelected = selectedAgent?.id === agent.id;

            return (
              <div
                key={agent.id}
                onClick={() => setSelectedAgent(isSelected ? null : agent)}
                className={cn(
                  'rounded-2xl p-5 cursor-pointer transition-all',
                  isSelected ? 'bg-card ring-1 ring-primary/40' : 'bg-card hover:ring-1 hover:ring-primary/20'
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-sidebar-accent flex items-center justify-center">
                      <Bot className="h-5 w-5 text-card-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-card-foreground">{agent.name}</p>
                      <p className="text-xs text-card-foreground/50">
                        {roleLabels[agent.role] || agent.role}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', sc.dot)} />
                    <span className={cn('text-[10px] font-medium tracking-wider', sc.text)}>{sc.label}</span>
                  </div>
                </div>

                {desc && (
                  <p className="text-[11px] text-card-foreground/40 leading-relaxed mb-3">{desc}</p>
                )}

                <div className="mb-3">
                  <p className="text-[10px] text-card-foreground/30 uppercase tracking-wider">Current Task</p>
                  <p className="text-xs text-card-foreground/70 truncate mt-0.5">
                    {agent.current_task || 'No active task'}
                  </p>
                </div>

                <div className="flex gap-2 mb-3">
                  {[
                    { label: 'Active', value: agTasksActive, color: 'text-primary' },
                    { label: 'Queued', value: agTasksQueued, color: 'text-warning' },
                    { label: 'Done', value: agTasksDone, color: 'text-success' },
                  ].map(s => (
                    <div key={s.label} className="flex-1 p-2 bg-white/5 rounded-xl text-center">
                      <p className="text-[9px] text-card-foreground/30 uppercase">{s.label}</p>
                      <p className={cn('text-sm font-bold', s.color)}>{s.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
                  <Button
                    size="sm"
                    disabled={updating === agent.id || agent.status === 'online'}
                    onClick={() => updateAgentStatus(agent, 'online')}
                    className="h-7 text-[10px] font-medium gap-1 flex-1 min-w-0 bg-transparent border border-success/30 text-success hover:bg-success/10 rounded-lg"
                  >
                    <Play className="h-3 w-3 shrink-0" /> Start
                  </Button>
                  <Button
                    size="sm"
                    disabled={updating === agent.id || agent.status === 'idle'}
                    onClick={() => updateAgentStatus(agent, 'idle')}
                    className="h-7 text-[10px] font-medium gap-1 flex-1 min-w-0 bg-transparent border border-warning/30 text-warning hover:bg-warning/10 rounded-lg"
                  >
                    <Pause className="h-3 w-3 shrink-0" /> Pause
                  </Button>
                  <Button
                    size="sm"
                    disabled={updating === agent.id}
                    onClick={() => updateAgentStatus(agent, 'online')}
                    className="h-7 text-[10px] font-medium gap-1 flex-1 min-w-0 bg-transparent border border-card-foreground/10 text-card-foreground/40 hover:text-primary hover:border-primary/30 rounded-lg"
                  >
                    <RotateCcw className="h-3 w-3 shrink-0" /> Restart
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Agent task detail */}
      {selectedAgent && (
        <div className="rounded-2xl bg-card p-5 ring-1 ring-primary/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-card-foreground">
                {selectedAgent.name} — Task History
              </h3>
            </div>
            <span className={cn('text-[10px] font-medium uppercase', statusConfig[selectedAgent.status || 'offline'].text)}>
              {selectedAgent.status}
            </span>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-auto dark-scrollbar">
            {agentTasks(selectedAgent.name).length === 0 ? (
              <p className="text-xs text-card-foreground/40 py-4 text-center">No tasks yet</p>
            ) : (
              agentTasks(selectedAgent.name).map(task => (
                <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5">
                  <div className={cn(
                    'h-1.5 w-1.5 rounded-full shrink-0',
                    task.status === 'completed' ? 'bg-success' :
                    task.status === 'executing' ? 'bg-primary animate-pulse' :
                    task.status === 'failed' ? 'bg-destructive' :
                    'bg-warning'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-card-foreground/80 truncate">{task.task_type}</p>
                    <p className="text-[10px] text-card-foreground/30">
                      {task.created_at ? new Date(task.created_at).toLocaleString() : ''}
                    </p>
                  </div>
                  <Badge className={cn(
                    'text-[9px] border rounded-lg',
                    task.status === 'completed' ? 'bg-success/20 text-success border-success/30' :
                    task.status === 'executing' ? 'bg-primary/20 text-primary border-primary/30' :
                    task.status === 'failed' ? 'bg-destructive/20 text-destructive border-destructive/30' :
                    'bg-warning/20 text-warning border-warning/30'
                  )}>
                    {task.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* System overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Online Agents',  value: agents.filter(a => a.status === 'online').length,    icon: <Activity className="h-4 w-4" />,   color: 'text-success' },
          { label: 'Idle Agents',    value: agents.filter(a => a.status === 'idle').length,      icon: <Clock className="h-4 w-4" />,      color: 'text-warning' },
          { label: 'Error Agents',   value: agents.filter(a => a.status === 'error').length,     icon: <AlertCircle className="h-4 w-4" />,color: 'text-destructive' },
          { label: 'Active Tasks',   value: tasks.filter(t => t.status === 'executing').length,  icon: <Cpu className="h-4 w-4" />,        color: 'text-primary' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl bg-card px-4 py-3 flex items-center gap-3">
            <span className={stat.color}>{stat.icon}</span>
            <div>
              <p className="text-[10px] text-card-foreground/40 uppercase tracking-wider">{stat.label}</p>
              <p className={cn('text-xl font-bold', stat.color)}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
