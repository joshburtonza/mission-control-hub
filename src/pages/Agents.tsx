import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Bot, Play, Pause, RotateCcw, Terminal, Activity, Cpu,
  RefreshCw, CheckCircle2, AlertCircle, Clock, WifiOff,
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

const statusConfig: Record<string, { label: string; dot: string; text: string; border: string }> = {
  online:  { label: 'ONLINE',  dot: 'bg-success animate-pulse',       text: 'text-success',           border: 'border-success/30' },
  idle:    { label: 'IDLE',    dot: 'bg-warning animate-pulse',        text: 'text-warning',           border: 'border-warning/30' },
  offline: { label: 'OFFLINE', dot: 'bg-muted-foreground',             text: 'text-muted-foreground',  border: 'border-border/30' },
  error:   { label: 'ERROR',   dot: 'bg-destructive animate-pulse',    text: 'text-destructive',       border: 'border-destructive/30' },
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
        action: `agent_status_changed`,
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

  const statusIcon = (s: string | null) => {
    switch (s) {
      case 'online':  return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'idle':    return <Clock className="h-4 w-4 text-warning" />;
      case 'error':   return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:        return <WifiOff className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold tracking-wider text-foreground glow-cyan">Agents</h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Real-time agent management · {agents.filter(a => a.status === 'online').length} online
        </p>
      </div>

      {loading ? (
        <div className="font-mono text-xs text-muted-foreground animate-pulse">Loading agents...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {agents.map(agent => {
            const sc = statusConfig[agent.status || 'offline'];
            const desc = agentDescriptions[agent.name];
            const agTasksActive = agentTasks(agent.name).filter(t => t.status === 'executing').length;
            const agTasksQueued = agentTasks(agent.name).filter(t => t.status === 'queued').length;
            const isSelected = selectedAgent?.id === agent.id;

            return (
              <Card
                key={agent.id}
                onClick={() => setSelectedAgent(isSelected ? null : agent)}
                className={cn(
                  'cursor-pointer transition-all duration-200 border',
                  isSelected ? 'border-primary/60 bg-secondary/50' : `${sc.border} bg-card hover:border-primary/30`
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center border border-border/50">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-display tracking-wide">{agent.name}</CardTitle>
                        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                          {roleLabels[agent.role] || agent.role}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn('h-2 w-2 rounded-full', sc.dot)} />
                      <span className={cn('font-mono text-[10px] tracking-wider', sc.text)}>{sc.label}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {desc && (
                    <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">{desc}</p>
                  )}
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Current Task</p>
                    <p className="text-xs font-mono text-foreground/80 truncate">
                      {agent.current_task || 'No active task'}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 p-2 bg-secondary/30 rounded border border-border/30 text-center">
                      <p className="font-mono text-[9px] text-muted-foreground uppercase">Active</p>
                      <p className="font-display text-sm text-primary">{agTasksActive}</p>
                    </div>
                    <div className="flex-1 p-2 bg-secondary/30 rounded border border-border/30 text-center">
                      <p className="font-mono text-[9px] text-muted-foreground uppercase">Queued</p>
                      <p className="font-display text-sm text-warning">{agTasksQueued}</p>
                    </div>
                    <div className="flex-1 p-2 bg-secondary/30 rounded border border-border/30 text-center">
                      <p className="font-mono text-[9px] text-muted-foreground uppercase">Done</p>
                      <p className="font-display text-sm text-success">
                        {agentTasks(agent.name).filter(t => t.status === 'completed').length}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 pt-1" onClick={e => e.stopPropagation()}>
                    <Button
                      size="sm"
                      disabled={updating === agent.id || agent.status === 'online'}
                      onClick={() => updateAgentStatus(agent, 'online')}
                      className="h-7 text-[10px] font-mono gap-1 bg-transparent border border-success/40 text-success hover:bg-success/10"
                    >
                      <Play className="h-3 w-3" /> Start
                    </Button>
                    <Button
                      size="sm"
                      disabled={updating === agent.id || agent.status === 'idle'}
                      onClick={() => updateAgentStatus(agent, 'idle')}
                      className="h-7 text-[10px] font-mono gap-1 bg-transparent border border-warning/40 text-warning hover:bg-warning/10"
                    >
                      <Pause className="h-3 w-3" /> Pause
                    </Button>
                    <Button
                      size="sm"
                      disabled={updating === agent.id}
                      onClick={() => updateAgentStatus(agent, 'online')}
                      className="h-7 text-[10px] font-mono gap-1 bg-transparent border border-border/50 text-muted-foreground hover:text-primary hover:border-primary/50"
                    >
                      <RotateCcw className="h-3 w-3" /> Restart
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Agent task detail */}
      {selectedAgent && (
        <Card className="border-primary/30 bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-display tracking-wide">
                  {selectedAgent.name} — Task History
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {statusIcon(selectedAgent.status)}
                <span className="font-mono text-[10px] text-muted-foreground uppercase">
                  {selectedAgent.status}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-1.5 pr-2">
                {agentTasks(selectedAgent.name).length === 0 ? (
                  <p className="text-xs font-mono text-muted-foreground py-4 text-center">No tasks yet</p>
                ) : (
                  agentTasks(selectedAgent.name).map(task => (
                    <div key={task.id} className="flex items-center gap-3 p-2 rounded bg-secondary/20 border border-border/30">
                      <div className={cn(
                        'h-1.5 w-1.5 rounded-full shrink-0',
                        task.status === 'completed' ? 'bg-success' :
                        task.status === 'executing' ? 'bg-primary animate-pulse' :
                        task.status === 'failed' ? 'bg-destructive' :
                        'bg-warning'
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-[10px] text-foreground/80 truncate">{task.task_type}</p>
                        <p className="font-mono text-[9px] text-muted-foreground">
                          {task.created_at ? new Date(task.created_at).toLocaleString() : ''}
                        </p>
                      </div>
                      <Badge className={cn(
                        'text-[9px] font-mono border',
                        task.status === 'completed' ? 'bg-success/10 text-success border-success/30' :
                        task.status === 'executing' ? 'bg-primary/10 text-primary border-primary/30' :
                        task.status === 'failed' ? 'bg-destructive/10 text-destructive border-destructive/30' :
                        'bg-warning/10 text-warning border-warning/30'
                      )}>
                        {task.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* System overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Online Agents',  value: agents.filter(a => a.status === 'online').length,    icon: <Activity className="h-4 w-4" />,   color: 'text-success' },
          { label: 'Idle Agents',    value: agents.filter(a => a.status === 'idle').length,      icon: <Clock className="h-4 w-4" />,      color: 'text-warning' },
          { label: 'Error Agents',   value: agents.filter(a => a.status === 'error').length,     icon: <AlertCircle className="h-4 w-4" />,color: 'text-destructive' },
          { label: 'Active Tasks',   value: tasks.filter(t => t.status === 'executing').length,  icon: <Cpu className="h-4 w-4" />,        color: 'text-primary' },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border/50 rounded-md px-4 py-3 flex items-center gap-3">
            <span className={stat.color}>{stat.icon}</span>
            <div>
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              <p className={cn('font-display text-xl', stat.color)}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
