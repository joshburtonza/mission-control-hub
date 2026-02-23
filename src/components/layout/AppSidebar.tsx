import {
  LayoutDashboard, Bot, ListTodo, ClipboardList, DollarSign, Calendar,
  Settings, CheckSquare, FileText, Bell,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";

const mainNav = [
  { icon: LayoutDashboard, url: "/",          label: "Dashboard",  end: true },
  { icon: Bot,             url: "/agents",    label: "Agents" },
  { icon: CheckSquare,     url: "/approvals", label: "Approvals" },
  { icon: ListTodo,        url: "/tasks",     label: "Tasks" },
  { icon: FileText,        url: "/content",   label: "Content" },
  { icon: DollarSign,      url: "/finances",  label: "Finances" },
  { icon: Calendar,        url: "/calendar",  label: "Calendar" },
  { icon: Bell,            url: "/notifications", label: "Alerts" },
  { icon: ClipboardList,   url: "/audit",     label: "Audit" },
];

function NavItem({ icon: Icon, url, label, end }: {
  icon: React.ElementType; url: string; label: string; end?: boolean;
}) {
  return (
    <NavLink
      to={url}
      end={end}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground",
        "hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-all duration-150",
        "text-sm font-medium"
      )}
      activeClassName="bg-primary/15 text-primary border border-primary/20 shadow-[0_0_12px_hsl(213_94%_57%/0.15)]"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </NavLink>
  );
}

const mobileNav = [
  { icon: LayoutDashboard, url: "/",          label: "Home",     end: true },
  { icon: CheckSquare,     url: "/approvals", label: "Approvals" },
  { icon: ListTodo,        url: "/tasks",     label: "Tasks" },
  { icon: DollarSign,      url: "/finances",  label: "Money" },
  { icon: Settings,        url: "/settings",  label: "Settings" },
];

export function AppSidebar() {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-52 bg-sidebar flex-col py-5 px-3 gap-1 shrink-0 border-r border-sidebar-border">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <div className="w-0 h-0 border-l-[7px] border-l-white border-t-[4.5px] border-t-transparent border-b-[4.5px] border-b-transparent ml-0.5" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-none">Amalfi</p>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Mission Control</p>
          </div>
        </div>

        {/* Main nav */}
        <nav className="flex flex-col gap-0.5 flex-1">
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest px-3 mb-1">Main</p>
          {mainNav.slice(0, 4).map((item) => (
            <NavItem key={item.url} {...item} />
          ))}
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest px-3 mt-4 mb-1">Reports</p>
          {mainNav.slice(4).map((item) => (
            <NavItem key={item.url} {...item} />
          ))}
        </nav>

        {/* Bottom */}
        <div className="flex flex-col gap-0.5 pt-2 border-t border-sidebar-border">
          <NavItem icon={Settings} url="/settings" label="Settings" />
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border">
        <div className="flex items-center justify-around h-16 px-1 pb-[env(safe-area-inset-bottom)]">
          {mobileNav.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.end}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 text-sidebar-foreground transition-colors"
              activeClassName="text-primary"
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[9px] font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
