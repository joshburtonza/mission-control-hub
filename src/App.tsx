import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
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
import NotFound from "./pages/NotFound";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <BrowserRouter>
        <DashboardLayout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/content" element={<Content />} />
            <Route path="/crm" element={<CRMPage />} />
            <Route path="/research" element={<ResearchPage />} />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="/finances" element={<Finances />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </DashboardLayout>
      </BrowserRouter>
    </TooltipProvider>
);

export default App;
