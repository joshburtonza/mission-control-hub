import { useState, useEffect } from "react";
import { Search, Wifi, WifiOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function Header() {
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
    <header className="h-12 border-b border-border/50 flex items-center justify-between px-4 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground hover:text-primary" />
        <div className="hidden md:flex items-center gap-2 text-muted-foreground">
          <Search className="h-3.5 w-3.5" />
          <Input
            placeholder="Search systems..."
            className="h-7 w-48 bg-transparent border-border/50 text-xs font-mono placeholder:text-muted-foreground/50 focus-visible:ring-primary/30"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {online ? (
            <Wifi className="h-3.5 w-3.5 text-success" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-destructive" />
          )}
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            {online ? "Online" : "Offline"}
          </span>
        </div>
        <div className="font-mono text-xs text-primary tabular-nums glow-cyan">
          {time.toLocaleTimeString("en-US", { hour12: false })}
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">
          {time.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
        </div>
      </div>
    </header>
  );
}
