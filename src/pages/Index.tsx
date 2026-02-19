import React, { useState, useEffect } from 'react';
import { AgentCard, AgentStatus } from "@/components/dashboard/AgentCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { SystemStats } from "@/components/dashboard/SystemStats";
import { EmailQueue } from "@/components/EmailQueue";
import { KillSwitch } from "@/components/KillSwitch";
import { supabase } from "@/integrations/supabase/client";

interface AgentRow {
  id: string;
  name: string;
  role: string;
  status: string | null;
  current_task: string | null;
  last_activity: string | null;
}

const timeSince = (ts: string | null) => {
  if (!ts) return 'Unknown';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
};

const Index = () => {
  const [agents, setAgents] = useState<AgentRow[]>([]);

  useEffect(() => {
    fetchAgents();
    const channel = supabase
      .channel('index_agents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, fetchAgents)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchAgents = async () => {
    const { data } = await supabase.from('agents').select('*').order('name');
    if (data) setAgents(data);
  };

  return (
    <div className="w-full min-h-screen bg-black p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-x-hidden">
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur -mx-3 sm:-mx-6 px-3 sm:px-6 py-3 sm:py-4">
        <h1 className="font-display text-lg sm:text-xl font-bold tracking-wider text-foreground glow-cyan">
          Mission Control
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          System overview · All agents reporting
        </p>
      </div>
      <div className="overflow-x-auto">
        <SystemStats />
      </div>
      <div>
        <h2 className="font-mono text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground mb-2 sm:mb-3">
          Active Agents
        </h2>
        {agents.length === 0 ? (
          <div className="font-mono text-xs text-muted-foreground p-4 border border-border/30 rounded-md text-center">
            No agents in Supabase yet
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            {agents.map((agent) => (
              <div key={agent.id} className="min-w-0">
                <AgentCard
                  name={agent.name}
                  status={(agent.status as AgentStatus) || 'offline'}
                  lastActivity={timeSince(agent.last_activity)}
                  currentTask={agent.current_task || 'Idle'}
                  type={agent.role}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
        <div className="lg:col-span-2 min-w-0 overflow-hidden">
          <EmailQueue />
        </div>
        <div className="lg:col-span-1 min-w-0 overflow-hidden">
          <KillSwitch />
        </div>
      </div>
      <div className="overflow-x-auto">
        <ActivityFeed />
      </div>
    </div>
  );
};

export default Index;
