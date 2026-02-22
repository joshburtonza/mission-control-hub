import { useState, useEffect } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { useLocation } from "react-router-dom";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Mission Control", subtitle: "System overview" },
  "/agents": { title: "Agents", subtitle: "Real-time status & management" },
  "/tasks": { title: "Task Board", subtitle: "Live queue" },
  "/audit": { title: "Audit Log", subtitle: "Decision & action history" },
  "/finances": { title: "Finances", subtitle: "Tracking" },
  "/calendar": { title: "Calendar", subtitle: "Schedule & reminders" },
  "/settings": { title: "Settings", subtitle: "System configuration" },
};

export function Header() {
  const location = useLocation();
  const page = pageTitles[location.pathname] || pageTitles["/"];
  const [time, setTime] = useState(new Date());
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
    };
  }, []);

  return (
    <header className="flex items-center justify-between px-4 md:px-6 pt-4 md:pt-6 pb-2">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight">
          {page.title}
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground">{page.subtitle}</p>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <div className="flex items-center gap-1.5">
          {online ? (
            <Wifi className="h-3.5 w-3.5 text-success" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-destructive" />
          )}
          <span className="text-[10px] md:text-xs text-muted-foreground hidden sm:inline">
            {online ? "Connected" : "Offline"}
          </span>
        </div>
        <span className="text-[10px] md:text-xs text-muted-foreground tabular-nums">
          {time.toLocaleTimeString("en-US", { hour12: false })}
        </span>
        <span className="text-[10px] md:text-xs text-muted-foreground hidden sm:inline">
          {time.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
        </span>
      </div>
    </header>
  );
}
