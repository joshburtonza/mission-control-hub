import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Zap, GitBranch, Activity, Mail, Video, Heart, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AgentRow {
  id: string;
  name: string;
  role: string;
  status: string | null;
  current_task: string | null;
  last_activity: string | null;
}

// Static agent hierarchy definition
const AGENT_HIERARCHY = [
  {
    name: 'Alex Claww',
    role: 'Main Orchestrator',
    model: 'claude-sonnet-4-6',
    tier: 'parent',
    icon: <Zap className="h-4 w-4" />,
    color: 'border-cyan-600/50 bg-cyan-900/10',
    badgeColor: 'bg-cyan-900/50 text-cyan-300 border-cyan-700/50',
    description: 'Main agent. Handles chat, coordinates all child agents, manages approvals.',
    children: [
      {
        name: 'Sophia CSM',
        role: 'Customer Success',
        model: 'claude-sonnet-4-6',
        icon: <Mail className="h-3.5 w-3.5" />,
        color: 'border-green-600/40 bg-green-900/10',
        badgeColor: 'bg-green-900/50 text-green-300 border-green-700/50',
        schedule: 'Every 5min',
        description: 'Monitors customer emails, triages, drafts responses, escalates to Josh.',
      },
      {
        name: 'Alex Outreach',
        role: 'Cold Outreach',
        model: 'claude-sonnet-4-6',
        icon: <Zap className="h-3.5 w-3.5" />,
        color: 'border-orange-600/40 bg-orange-900/10',
        badgeColor: 'bg-orange-900/50 text-orange-300 border-orange-700/50',
        schedule: 'Daily 9am (Mon-Fri)',
        description: 'Sends personalised cold emails from alex@amalfiai.com. Waiting on lead list.',
      },
      {
        name: 'Video Bot',
        role: 'Content Generation',
        model: 'claude-sonnet-4-6',
        icon: <Video className="h-3.5 w-3.5" />,
        color: 'border-purple-600/40 bg-purple-900/10',
        badgeColor: 'bg-purple-900/50 text-purple-300 border-purple-700/50',
        schedule: 'Daily 7am',
        description: 'Generates 4 shootable video scripts using Callaway framework.',
      },
      {
        name: 'Repo Watcher',
        role: 'Code Monitoring',
        model: 'claude-haiku-4-5',
        icon: <GitBranch className="h-3.5 w-3.5" />,
        color: 'border-blue-600/40 bg-blue-900/10',
        badgeColor: 'bg-blue-900/50 text-blue-300 border-blue-700/50',
        schedule: 'Tuesday 9am',
        description: 'Pulls latest from 3 client repos, summarises commits for Sophia context.',
      },
      {
        name: 'Heartbeat',
        role: 'System Health',
        model: 'claude-haiku-4-5',
        icon: <Heart className="h-3.5 w-3.5" />,
        color: 'border-red-600/40 bg-red-900/10',
        badgeColor: 'bg-red-900/50 text-red-300 border-red-700/50',
        schedule: 'Daily 12pm',
        description: 'Checks escalations, email backlog, repo changes. Posts system health to Mission Control.',
      },
      {
        name: 'Memory Bot',
        role: 'Knowledge Curation',
        model: 'claude-sonnet-4-6',
        icon: <Activity className="h-3.5 w-3.5" />,
        color: 'border-yellow-600/40 bg-yellow-900/10',
        badgeColor: 'bg-yellow-900/50 text-yellow-300 border-yellow-700/50',
        schedule: 'Sunday 6pm',
        description: 'Reviews weekly logs, distils key learnings into MEMORY.md long-term memory.',
      },
    ],
  },
];

const statusColors: Record<string, string> = {
  online:  'text-success bg-success/10 border-success/30',
  idle:    'text-warning bg-warning/10 border-warning/30',
  offline: 'text-muted-foreground bg-secondary/30 border-border/30',
  error:   'text-destructive bg-destructive/10 border-destructive/30',
};

export default function Agents() {
  const [liveAgents, setLiveAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents();
    const channel = supabase
      .channel('agents_page_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, fetchAgents)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchAgents = async () => {
    const { data } = await supabase.from('agents').select('*').order('name');
    if (data) setLiveAgents(data);
    setLoading(false);
  };

  const getLiveData = (name: string) =>
    liveAgents.find(a => a.name.toLowerCase().includes(name.toLowerCase().split(' ')[0]));

  const timeSince = (ts: string | null) => {
    if (!ts) return 'Unknown';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  const parent = AGENT_HIERARCHY[0];
  const parentLive = getLiveData(parent.name);
  const parentStatus = parentLive?.status || 'online';

  return (
    <div className="space-y-4 pb-24 sm:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-wider text-foreground glow-cyan flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Agent Hierarchy
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            1 parent · {parent.children.length} child agents · {liveAgents.filter(a => a.status === 'online').length} online
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchAgents}
          className="h-7 w-7 p-0 border-border/40 text-muted-foreground hover:text-primary">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Parent Agent */}
      <Card className={cn('border-2', parent.color)}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={cn('h-10 w-10 rounded-md border flex items-center justify-center shrink-0', parent.badgeColor)}>
              {parent.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-display text-sm font-bold text-foreground tracking-wide">{parent.name}</p>
                <Badge className="text-[8px] font-mono border bg-black/40 text-muted-foreground border-border/40">PARENT</Badge>
                <Badge className={cn('text-[8px] font-mono border', statusColors[parentStatus])}>
                  {parentStatus.toUpperCase()}
                </Badge>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{parent.role}</p>
              <p className="font-mono text-[10px] text-foreground/60 mt-1">{parent.description}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-[9px] text-muted-foreground">Model</p>
              <p className="font-mono text-[9px] text-cyan-400">{parent.model}</p>
              {parentLive?.last_activity && (
                <p className="font-mono text-[8px] text-muted-foreground/60 mt-1">{timeSince(parentLive.last_activity)}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection line + Children */}
      <div className="relative pl-5">
        <div className="absolute left-0 top-0 bottom-0 w-px bg-border/40 ml-2" />
        <div className="space-y-3">
          {parent.children.map((child, i) => {
            const childLive = getLiveData(child.name);
            const childStatus = childLive?.status || 'idle';
            return (
              <div key={i} className="relative">
                {/* Connector */}
                <div className="absolute -left-5 top-5 w-5 h-px bg-border/40" />
                <Card className={cn('border', child.color)}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={cn('h-8 w-8 rounded-md border flex items-center justify-center shrink-0', child.badgeColor)}>
                        {child.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-mono text-xs font-medium text-foreground">{child.name}</p>
                          <Badge className={cn('text-[8px] font-mono border', statusColors[childStatus])}>
                            {childStatus.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="font-mono text-[9px] text-muted-foreground mt-0.5">{child.role} · {child.schedule}</p>
                        <p className="font-mono text-[9px] text-foreground/50 mt-0.5 line-clamp-1">{child.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-[8px] text-muted-foreground">Model</p>
                        <p className={cn('font-mono text-[8px]',
                          child.model.includes('sonnet') ? 'text-cyan-400' : 'text-yellow-500')}>
                          {child.model.includes('sonnet') ? 'Sonnet 4.6' : 'Haiku 4.5'}
                        </p>
                        {childLive?.current_task && (
                          <p className="font-mono text-[8px] text-muted-foreground/60 mt-1 max-w-20 truncate">{childLive.current_task}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      {/* Model legend */}
      <Card className="border-border/30 bg-card">
        <CardContent className="p-3">
          <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-2">Model Allocation</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-cyan-900/20 border border-cyan-700/30 rounded p-2">
              <p className="font-mono text-[10px] text-cyan-300 font-medium">claude-sonnet-4-6</p>
              <p className="font-mono text-[9px] text-muted-foreground mt-0.5">Alex, Sophia, Outreach, Videos, Memory</p>
              <p className="font-mono text-[8px] text-muted-foreground/60 mt-0.5">Client-facing · creative · complex</p>
            </div>
            <div className="bg-yellow-900/20 border border-yellow-700/30 rounded p-2">
              <p className="font-mono text-[10px] text-yellow-400 font-medium">claude-haiku-4-5</p>
              <p className="font-mono text-[9px] text-muted-foreground mt-0.5">Repo Watcher, Heartbeat, Discord greetings</p>
              <p className="font-mono text-[8px] text-muted-foreground/60 mt-0.5">Structured · fast · cost-efficient</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
