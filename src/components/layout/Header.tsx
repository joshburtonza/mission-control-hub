import { useState, useEffect } from "react";
import { Wifi, WifiOff, Sun, Moon, Bell, LogOut } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/":           { title: "Mission Control",  subtitle: "System overview" },
  "/crm":        { title: "CRM",              subtitle: "Leads, pipeline & contacts" },
  "/csm":        { title: "CSM",              subtitle: "Client success & Sophia queue" },
  "/clients":    { title: "Client OS",        subtitle: "Active client systems" },
  "/finances":   { title: "Finances",         subtitle: "Revenue, debt & cash flow" },
  "/content":    { title: "Content",          subtitle: "Scripts & outreach pipeline" },
  "/docs":       { title: "Docs",             subtitle: "SOPs, proposals & reports" },
  "/contracts":  { title: "Contracts",        subtitle: "Retainers & agreements" },
  "/tasks":      { title: "Task Board",       subtitle: "Queue tasks for Claude" },
  "/calendar":   { title: "Calendar",         subtitle: "Schedule & reminders" },
  "/settings":   { title: "Settings",         subtitle: "System configuration" },
  "/agents":     { title: "Agents",           subtitle: "Real-time status & management" },
  "/approvals":  { title: "Approvals",        subtitle: "Email escalation queue" },
  "/audit":      { title: "Audit Log",        subtitle: "Decision & action history" },
  "/notifications": { title: "Notifications", subtitle: "Alerts & escalations" },
  "/status":     { title: "System Status",    subtitle: "Health & cron jobs" },
  "/research":   { title: "Research",         subtitle: "Intelligence pipeline" },
  "/vanta":      { title: "Vanta OS",         subtitle: "Lead generation pipeline" },
};

export function Header() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const page      = pageTitles[location.pathname] || { title: "Mission Control", subtitle: "" };
  const [time, setTime]         = useState(new Date());
  const [online, setOnline]     = useState(navigator.onLine);
  const [unread, setUnread]     = useState(0);
  const { theme, setTheme }     = useTheme();
  const { mcUser, signOut }     = useAuth();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => { clearInterval(timer); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  /* ── Notification badge ── */
  useEffect(() => {
    fetchUnread();
    const ch = supabase.channel("header_notif")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, fetchUnread)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchUnread = async () => {
    try {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("status", "unread");
      setUnread(count ?? 0);
    } catch { /* ignore */ }
  };

  return (
    <header className="flex items-center justify-between px-5 md:px-7 pt-5 md:pt-6 pb-3 glass-header sticky top-0 z-40">
      <div>
        <h1 className="text-lg md:text-xl font-bold text-foreground leading-tight">{page.title}</h1>
        {page.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{page.subtitle}</p>}
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        {/* Notification bell */}
        <button
          onClick={() => navigate("/notifications")}
          className="relative h-8 w-8 flex items-center justify-center rounded-lg border border-border hover:border-primary/40 hover:bg-primary/10 transition-all text-muted-foreground hover:text-primary"
          title="Notifications"
        >
          <Bell className="h-3.5 w-3.5" />
          {unread > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full text-[9px] font-bold text-white leading-none"
              style={{ background: '#4B9EFF', boxShadow: '0 0 8px rgba(75,158,255,0.7)' }}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-border hover:border-primary/40 hover:bg-primary/10 transition-all text-muted-foreground hover:text-primary"
          title="Toggle theme"
        >
          {theme === "dark"
            ? <Sun  className="h-3.5 w-3.5" />
            : <Moon className="h-3.5 w-3.5" />
          }
        </button>

        {/* Connectivity */}
        <div className="flex items-center gap-1.5">
          {online
            ? <Wifi    className="h-3 w-3" style={{ color: '#4B9EFF' }} />
            : <WifiOff className="h-3 w-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
          }
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {online ? "Live" : "Offline"}
          </span>
        </div>

        {/* Clock */}
        <div className="text-right hidden sm:block">
          <p className="text-xs font-mono text-foreground tabular-nums">
            {time.toLocaleTimeString("en-ZA", { hour12: false })}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {time.toLocaleDateString("en-ZA", { weekday: "short", day: "2-digit", month: "short" })}
          </p>
        </div>

        {/* User + sign-out */}
        {mcUser && (
          <div className="flex items-center gap-2 pl-2" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-right hidden sm:block">
              <p className="text-[11px] font-medium text-foreground leading-none">{mcUser.display_name || mcUser.email.split('@')[0]}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5 capitalize">{mcUser.role}</p>
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              className="h-7 w-7 flex items-center justify-center rounded-lg border border-border hover:border-red-400/40 hover:bg-red-400/10 transition-all text-muted-foreground hover:text-red-400"
            >
              <LogOut className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
