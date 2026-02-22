import {
  LayoutDashboard, Bot, ListTodo, ClipboardList, DollarSign, Calendar,
  Settings,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";

const mainNav = [
  { icon: LayoutDashboard, url: "/", label: "Dashboard" },
  { icon: Bot, url: "/agents", label: "Agents" },
  { icon: ListTodo, url: "/tasks", label: "Tasks" },
  { icon: ClipboardList, url: "/audit", label: "Audit" },
  { icon: DollarSign, url: "/finances", label: "Finances" },
  { icon: Calendar, url: "/calendar", label: "Calendar" },
];

function SidebarIcon({
  icon: Icon,
  url,
  label,
  end,
}: {
  icon: React.ElementType;
  url: string;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={url}
      end={end}
      className="flex items-center justify-center w-10 h-10 rounded-xl text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors"
      activeClassName="bg-sidebar-accent text-white"
      title={label}
    >
      <Icon className="h-[18px] w-[18px]" />
    </NavLink>
  );
}

const mobileNav = [
  { icon: LayoutDashboard, url: "/", label: "Home" },
  { icon: Bot, url: "/agents", label: "Agents" },
  { icon: ListTodo, url: "/tasks", label: "Tasks" },
  { icon: ClipboardList, url: "/audit", label: "Audit" },
  { icon: Settings, url: "/settings", label: "Settings" },
];

export function AppSidebar() {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-16 bg-sidebar flex-col items-center py-4 gap-1 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-sidebar-accent flex items-center justify-center mb-4">
          <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center">
            <div className="w-0 h-0 border-l-[5px] border-l-white border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent ml-0.5" />
          </div>
        </div>

        <nav className="flex flex-col items-center gap-1 flex-1">
          {mainNav.map((item) => (
            <SidebarIcon
              key={item.url}
              icon={item.icon}
              url={item.url}
              label={item.label}
              end={item.url === "/"}
            />
          ))}
        </nav>

        <div className="flex flex-col items-center gap-1 mt-auto">
          <SidebarIcon icon={Settings} url="/settings" label="Settings" />
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border">
        <div className="flex items-center justify-around h-16 px-1 pb-[env(safe-area-inset-bottom)]">
          {mobileNav.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/"}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 text-sidebar-foreground transition-colors"
              activeClassName="text-white"
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
