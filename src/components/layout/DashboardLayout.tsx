import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto scanline pb-20 sm:pb-6">
            {children}
          </main>
        </div>
      </div>
      {/* Mobile bottom navigation — only visible on small screens */}
      <MobileNav />
    </SidebarProvider>
  );
}
