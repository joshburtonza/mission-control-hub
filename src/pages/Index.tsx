import { useState, useEffect } from "react";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { SystemStats } from "@/components/dashboard/SystemStats";
import { EmailQueue } from "@/components/EmailQueue";
import { KillSwitch } from "@/components/KillSwitch";
import { supabase } from "@/integrations/supabase/client";
import { Bot, CheckCircle2, AlertCircle, Clock, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface Agent {
  id: string;
  name: string;
  role: string;
  status: string | null;
  current_task: string | null;
  last_activity: string | null;
}

const statusConfig: Record<string, { label: string; dot: string; text: string }> = {
  online:  { label: "ONLINE",  dot: "bg-success animate-pulse", text: "text-success" },
  idle:    { label: "IDLE",    dot: "bg-warning animate-pulse",  text: "text-warning" },
  offline: { label: "OFFLINE", dot: "bg-muted-foreground",       text: "text-muted-foreground" },
  error:   { label: "ERROR",   dot: "bg-destructive animate-pulse", text: "text-destructive" },
};

const roleLabels: Record<string, string> = {
  csm:        "Customer Success",
  outreach:   "Cold Outreach",
  automation: "Automation",
  monitor:    "Monitor",
};

const Index = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents();

    const channel = supabase
      .channel("dashboard_agents")
      .on("postgres_changes", { event: "*", schema: "public", table: "agents" }, fetchAgents)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchAgents = async () => {
    const { data, error } = await supabase.from("agents").select("*").order("created_at");
    if (!error) setAgents(data || []);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Real-time stats from Supabase */}
      <SystemStats />

      {/* Agent overview - live from Supabase */}
      <div>
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-medium">
          Agents ({agents.filter(a => a.status === "online").length} online)
        </h2>
        {loading ? (
          <div className="text-sm text-muted-foreground animate-pulse">Loading agents...</div>
        ) : agents.length === 0 ? (
          <div className="rounded-2xl bg-card p-6 text-center">
            <p className="text-sm text-card-foreground/40">No agents configured yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {agents.map((agent) => {
              const sc = statusConfig[agent.status || "offline"];
              return (
                <div key={agent.id} className="rounded-2xl bg-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-sidebar-accent flex items-center justify-center">
                        <Bot className="h-4 w-4 text-card-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-card-foreground">{agent.name}</p>
                        <p className="text-[11px] text-card-foreground/40">
                          {roleLabels[agent.role] || agent.role}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn("h-2 w-2 rounded-full", sc.dot)} />
                      <span className={cn("text-[10px] font-medium tracking-wider", sc.text)}>
                        {sc.label}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-card-foreground/30 uppercase tracking-wider">Current Task</p>
                    <p className="text-xs text-card-foreground/60 truncate mt-0.5">
                      {agent.current_task || "No active task"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Email queue + Kill switch */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <EmailQueue />
        </div>
        <div className="lg:col-span-1">
          <KillSwitch />
        </div>
      </div>

      {/* Live activity */}
      <ActivityFeed />
    </div>
  );
};

export default Index;
