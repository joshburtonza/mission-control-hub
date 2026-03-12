import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import TetrisLoading from "@/components/ui/tetris-loader";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import Index from "./pages/Index";
import Agents from "./pages/Agents";
import Tasks from "./pages/Tasks";
import Content from "./pages/Content";
import Finances from "./pages/Finances";
import CalendarPage from "./pages/CalendarPage";
import SettingsPage from "./pages/SettingsPage";
import AuditLog from "./pages/AuditLog";
import Approvals from "./pages/Approvals";
import StatusPage from "./pages/StatusPage";
import NotificationsPage from "./pages/NotificationsPage";
import CRMPage from "./pages/CRMPage";
import ResearchPage from "./pages/ResearchPage";
import ClientsPage from "./pages/ClientsPage";
import VantaPage from "./pages/VantaPage";
import CSMPage from "./pages/CSMPage";
import DocsPage from "./pages/DocsPage";
import ContractsPage from "./pages/ContractsPage";
import SkillsPage from "./pages/SkillsPage";
import DataExportPage from "./pages/DataExportPage";
import NotFound from "./pages/NotFound";

// ── Auth guard — wraps all protected routes ───────────────────────────────────
function AuthGuard({ children }: { children: React.ReactNode }) {
  // All hooks must be called unconditionally at the top
  const { session, mcUser, loading, canAccess } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--s-bg)' }}>
        <TetrisLoading size="sm" speed="fast" showLoadingText={false} />
      </div>
    );
  }

  // Not logged in → show login
  if (!session) return <LoginPage />;

  // Logged in but not in mc_users → show access denied
  if (!mcUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: 'var(--s-bg)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--tc-70)' }}>Access not configured</p>
        <p className="text-xs" style={{ color: 'var(--tc-35)' }}>
          {session.user.email} is not registered in Mission Control. Ask Josh to add you.
        </p>
      </div>
    );
  }

  // Staff on a page they can't access → redirect to first allowed page
  if (!canAccess(location.pathname) && !mcUser.allowed_pages.includes('*')) {
    const first = mcUser.allowed_pages[0] || '/finances';
    return <Navigate to={first} replace />;
  }

  return <>{children}</>;
}

// ── Inner app (has access to AuthContext) ─────────────────────────────────────
function AppRoutes() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/crm" element={<CRMPage />} />
          <Route path="/csm" element={<CSMPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/finances" element={<Finances />} />
          <Route path="/content" element={<Content />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/contracts" element={<ContractsPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* Legacy / utility routes */}
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/research" element={<ResearchPage />} />
          <Route path="/vanta" element={<VantaPage />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/data-export" element={<DataExportPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </DashboardLayout>
    </AuthGuard>
  );
}

const App = () => (
  <TooltipProvider>
    <Toaster />
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
