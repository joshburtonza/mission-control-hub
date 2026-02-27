import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";
import { PullToRefresh } from "./PullToRefresh";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[100svh] flex w-full overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <PullToRefresh>
          {children}
        </PullToRefresh>
      </div>
    </div>
  );
}
