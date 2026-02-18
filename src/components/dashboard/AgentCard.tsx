import { Bot, Play, Pause, RotateCcw, Terminal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AgentStatus = "online" | "offline" | "error" | "idle";

interface AgentCardProps {
  name: string;
  status: AgentStatus;
  lastActivity: string;
  currentTask: string;
  type: string;
}

const statusConfig: Record<AgentStatus, { label: string; colorClass: string; dotClass: string }> = {
  online: { label: "ONLINE", colorClass: "text-success", dotClass: "bg-success animate-pulse-glow" },
  idle: { label: "IDLE", colorClass: "text-warning", dotClass: "bg-warning animate-pulse-glow" },
  offline: { label: "OFFLINE", colorClass: "text-muted-foreground", dotClass: "bg-muted-foreground" },
  error: { label: "ERROR", colorClass: "text-destructive", dotClass: "bg-destructive animate-pulse-glow" },
};

export function AgentCard({ name, status, lastActivity, currentTask, type }: AgentCardProps) {
  const sc = statusConfig[status];

  return (
    <Card className="bg-card border-border/50 glow-box-cyan hover:border-primary/30 transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-secondary flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-display tracking-wide text-foreground">
                {name}
              </CardTitle>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{type}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", sc.dotClass)} />
            <span className={cn("text-[10px] font-mono tracking-wider", sc.colorClass)}>
              {sc.label}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Current Task</p>
          <p className="text-xs font-mono text-foreground/80 truncate">{currentTask}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Last Activity</p>
          <p className="text-xs font-mono text-foreground/60">{lastActivity}</p>
        </div>
        <div className="flex gap-1.5 pt-1">
          <Button size="sm" variant="outline" className="h-7 text-[10px] font-mono gap-1 border-border/50 text-muted-foreground hover:text-primary hover:border-primary/50">
            <Play className="h-3 w-3" /> Start
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] font-mono gap-1 border-border/50 text-muted-foreground hover:text-warning hover:border-warning/50">
            <Pause className="h-3 w-3" /> Pause
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] font-mono gap-1 border-border/50 text-muted-foreground hover:text-primary hover:border-primary/50">
            <RotateCcw className="h-3 w-3" /> Restart
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] font-mono gap-1 border-border/50 text-muted-foreground hover:text-accent hover:border-accent/50">
            <Terminal className="h-3 w-3" /> Logs
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
