import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Tenants from '@/pages/Tenants';
import TenantDetail from '@/pages/TenantDetail';
import TenantEdit from '@/pages/TenantEdit';
import Subscriptions from '@/pages/Subscriptions';
import Invoices from '@/pages/Invoices';
import Admins from '@/pages/Admins';
import Settings from '@/pages/Settings';
import Logs from '@/pages/Logs';
import Login from '@/pages/Login';
import AiConfiguration from '@/pages/AiConfiguration';
import BillingPackages from '@/pages/BillingPackages';
import TenantUsage from '@/pages/TenantUsage';
import Migrations from '@/pages/Migrations';
import PlatformKnowledge from '@/pages/PlatformKnowledge';
import SupportTickets from '@/pages/SupportTickets';
import { useAuth } from '@/context/AuthContext';
import './index.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/tenants" element={<Tenants />} />
            <Route path="/tenants/:id" element={<TenantDetail />} />
            <Route path="/tenants/:id/edit" element={<TenantEdit />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/admins" element={<Admins />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/ai-configuration" element={<AiConfiguration />} />
            <Route path="/billing-packages" element={<BillingPackages />} />
            <Route path="/tenant-usage" element={<TenantUsage />} />
            <Route path="/migrations" element={<Migrations />} />
            <Route path="/platform-knowledge" element={<PlatformKnowledge />} />
            <Route path="/support-tickets" element={<SupportTickets />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
