import { useState, useEffect } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { useLocation } from "react-router-dom";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/":              { title: "Mission Control",  subtitle: "System overview" },
  "/agents":        { title: "Agents",           subtitle: "Real-time status & management" },
  "/approvals":     { title: "Approvals",        subtitle: "Email escalation queue" },
  "/tasks":         { title: "Task Board",       subtitle: "Queue tasks for Claude" },
  "/content":       { title: "Content",          subtitle: "Scripts & outreach pipeline" },
  "/audit":         { title: "Audit Log",        subtitle: "Decision & action history" },
  "/finances":      { title: "Finances",         subtitle: "Revenue & debt tracking" },
  "/calendar":      { title: "Calendar",         subtitle: "Schedule & reminders" },
  "/notifications": { title: "Notifications",    subtitle: "Alerts & escalations" },
  "/settings":      { title: "Settings",         subtitle: "System configuration" },
  "/status":        { title: "System Status",    subtitle: "Health & cron jobs" },
};

export function Header() {
  const location = useLocation();
  const page = pageTitles[location.pathname] || { title: "Mission Control", subtitle: "" };
  const [time, setTime] = useState(new Date());
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    const onlineHandler  = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    window.addEventListener("online",  onlineHandler);
    window.addEventListener("offline", offlineHandler);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online",  onlineHandler);
      window.removeEventListener("offline", offlineHandler);
    };
  }, []);

  return (
    <header className="flex items-center justify-between px-5 md:px-7 pt-5 md:pt-6 pb-3 border-b border-border/50">
      <div>
        <h1 className="text-lg md:text-xl font-bold text-foreground leading-tight">
          {page.title}
        </h1>
        {page.subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{page.subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <div className="flex items-center gap-1.5">
          {online ? (
            <Wifi className="h-3 w-3 text-success" />
          ) : (
            <WifiOff className="h-3 w-3 text-destructive" />
          )}
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {online ? "Live" : "Offline"}
          </span>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-xs font-mono text-foreground tabular-nums">
            {time.toLocaleTimeString("en-ZA", { hour12: false })}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {time.toLocaleDateString("en-ZA", { weekday: "short", day: "2-digit", month: "short" })}
          </p>
        </div>
      </div>
    </header>
  );
}
