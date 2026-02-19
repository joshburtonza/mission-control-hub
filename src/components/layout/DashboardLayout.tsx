import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { PullToRefresh } from "./PullToRefresh";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <PullToRefresh>
            {children}
          </PullToRefresh>
        </div>
      </div>
      {/* Mobile bottom navigation — only visible on small screens */}
      <MobileNav />
    </SidebarProvider>
  );
}
