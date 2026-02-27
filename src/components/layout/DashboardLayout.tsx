import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";
import { PullToRefresh } from "./PullToRefresh";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full overflow-hidden" style={{ height: '100svh', minHeight: '100vh' }}>
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
