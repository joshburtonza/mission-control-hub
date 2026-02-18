import { Bot, LayoutDashboard, ListTodo, DollarSign, Calendar, Settings, ClipboardList, AlertTriangle, Activity, Bell } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Mission Control", url: "/",               icon: LayoutDashboard },
  { title: "Notifications",   url: "/notifications",  icon: Bell },
  { title: "Approvals",       url: "/approvals",      icon: AlertTriangle },
  { title: "System Status",   url: "/status",         icon: Activity },
  { title: "Agents",          url: "/agents",     icon: Bot },
  { title: "Tasks",           url: "/tasks",      icon: ListTodo },
  { title: "Audit Log",       url: "/audit",      icon: ClipboardList },
  { title: "Finances",        url: "/finances",   icon: DollarSign },
  { title: "Calendar",        url: "/calendar",   icon: Calendar },
  { title: "Settings",        url: "/settings",   icon: Settings },
];

export function AppSidebar() {
  return (
    <Sidebar className="border-r border-border/50">
      <div className="p-4 border-b border-border/50">
        <h1 className="font-display text-sm font-bold tracking-wider text-primary glow-cyan">
          OPENCLAW
        </h1>
        <p className="font-mono text-[10px] text-muted-foreground mt-1 tracking-widest uppercase">
          Mission Control v1.1
        </p>
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-mono text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
                      activeClassName="text-primary bg-secondary glow-box-cyan"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
