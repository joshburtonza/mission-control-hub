import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { PullToRefresh } from "./PullToRefresh";

// Pages that swipe navigation cycles through (matches MobileNav order)
const SWIPE_ROUTES = ['/', '/notifications', '/approvals', '/tasks', '/calendar'];

// Auto-refresh interval (ms)
const AUTO_REFRESH_MS = 30_000;

// Minimum horizontal distance to register a swipe
const SWIPE_THRESHOLD_PX = 60;

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  // ── Auto-refresh ────────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(k => k + 1);
    }, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  // ── Swipe navigation ─────────────────────────────────────────────────────────
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeStartX.current === null || swipeStartY.current === null) return;

    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    const dy = e.changedTouches[0].clientY - swipeStartY.current;

    swipeStartX.current = null;
    swipeStartY.current = null;

    // Ignore if mostly vertical (user is scrolling)
    if (Math.abs(dy) > Math.abs(dx)) return;
    // Ignore if swipe too short
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;

    const currentIndex = SWIPE_ROUTES.indexOf(location.pathname);
    if (currentIndex === -1) return; // not a swipeable page, ignore

    if (dx < 0) {
      // Swipe left → next page
      const next = SWIPE_ROUTES[currentIndex + 1];
      if (next) navigate(next);
    } else {
      // Swipe right → previous page
      const prev = SWIPE_ROUTES[currentIndex - 1];
      if (prev) navigate(prev);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div
          className="flex-1 flex flex-col min-w-0 overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <Header />
          {/* key prop remounts PullToRefresh + all page content every AUTO_REFRESH_MS */}
          <PullToRefresh key={refreshKey}>
            {children}
          </PullToRefresh>
        </div>
      </div>
      {/* Mobile bottom navigation — only visible on small screens */}
      <MobileNav />
    </SidebarProvider>
  );
}
