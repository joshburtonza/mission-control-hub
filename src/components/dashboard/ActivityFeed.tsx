import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  agent: string;
  message: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
}

const levelColors: Record<string, string> = {
  info: "text-primary",
  warn: "text-warning",
  error: "text-destructive",
  success: "text-success",
};

const mockActivity: ActivityItem[] = [
  { id: "1", agent: "ClawdBot", message: "Task completed: Email summary generated", timestamp: "12:45:02", level: "success" },
  { id: "2", agent: "MoltBot", message: "Monitoring GitHub repos for new issues", timestamp: "12:44:18", level: "info" },
  { id: "3", agent: "ClawdBot", message: "Telegram message processed from @user", timestamp: "12:43:55", level: "info" },
  { id: "4", agent: "System", message: "High memory usage detected on Mac-Studio", timestamp: "12:42:30", level: "warn" },
  { id: "5", agent: "MoltBot", message: "Failed to connect to API endpoint", timestamp: "12:41:12", level: "error" },
  { id: "6", agent: "ClawdBot", message: "Scheduled backup initiated", timestamp: "12:40:00", level: "info" },
  { id: "7", agent: "System", message: "All systems nominal", timestamp: "12:38:45", level: "success" },
];

export function ActivityFeed() {
  return (
    <Card className="bg-card border-border/50 glow-box-cyan">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-display tracking-wide">Live Activity Feed</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 max-h-64 overflow-auto">
          {mockActivity.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 py-1.5 px-2 rounded hover:bg-secondary/50 transition-colors"
            >
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums shrink-0 mt-0.5">
                {item.timestamp}
              </span>
              <span className={cn("font-mono text-[10px] shrink-0 w-16 mt-0.5", levelColors[item.level])}>
                [{item.agent}]
              </span>
              <span className="font-mono text-xs text-foreground/70">
                {item.message}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
