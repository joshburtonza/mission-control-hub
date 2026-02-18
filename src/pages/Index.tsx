import { AgentCard } from "@/components/dashboard/AgentCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { SystemStats } from "@/components/dashboard/SystemStats";
import { EmailQueue } from "@/components/EmailQueue";
import { KillSwitch } from "@/components/KillSwitch";

const agents = [
  {
    name: "ClawdBot",
    status: "online" as const,
    lastActivity: "2 min ago",
    currentTask: "Processing Telegram messages",
    type: "Primary Agent",
  },
  {
    name: "MoltBot",
    status: "idle" as const,
    lastActivity: "15 min ago",
    currentTask: "Waiting for scheduled task",
    type: "Secondary Agent",
  },
  {
    name: "Mac-Studio",
    status: "online" as const,
    lastActivity: "Just now",
    currentTask: "Running local automation scripts",
    type: "Local Machine",
  },
  {
    name: "Sentinel",
    status: "error" as const,
    lastActivity: "1 hr ago",
    currentTask: "Connection lost — retrying",
    type: "Monitor Bot",
  },
];

const Index = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold tracking-wider text-foreground glow-cyan">
          Mission Control
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          System overview • All agents reporting
        </p>
      </div>

      <SystemStats />

      <div>
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
          Active Agents
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.name} {...agent} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EmailQueue />
        </div>
        <div className="lg:col-span-1">
          <KillSwitch />
        </div>
      </div>

      <ActivityFeed />
    </div>
  );
};

export default Index;
