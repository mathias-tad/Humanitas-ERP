import { useAuth } from '@/context/AuthContext';
import { useERPModules, type ERPModuleKey } from '@/context/ModuleContext';
import { ShieldOff, Lock } from 'lucide-react';

interface PageGuardProps {
  /** Module that must be subscribed for this page to render */
  moduleKey: ERPModuleKey;
  /** Permission key the current user must have */
  permission: string;
  children: React.ReactNode;
}

/**
 * PageGuard — wraps a page with module subscription AND RBAC permission checks.
 *
 * Usage:
 *   <PageGuard moduleKey="payroll" permission="view_payroll">
 *     <MyPage />
 *   </PageGuard>
 *
 * Or inside a functional component:
 *   const guard = usePageGuard('payroll', 'view_payroll');
 *   if (guard) return guard;
 */
export function PageGuard({ moduleKey, permission, children }: PageGuardProps) {
  const { isModuleSubscribed } = useERPModules();
  const { hasPermission } = useAuth();

  if (!isModuleSubscribed(moduleKey)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <ShieldOff className="w-10 h-10 text-orange-400" />
        <p className="font-medium text-lg">Module Not Available</p>
        <p className="text-sm text-center max-w-xs">
          The <strong>{moduleKey.toUpperCase()}</strong> module is not included in your current
          subscription. Contact your administrator to enable it.
        </p>
      </div>
    );
  }

  if (!hasPermission(permission)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <Lock className="w-10 h-10 text-red-400" />
        <p className="font-medium text-lg">Access Denied</p>
        <p className="text-sm text-center max-w-xs">
          You do not have permission to view this page. Contact your administrator if you believe
          this is an error.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Hook version — returns a guard element if the user is not authorized,
 * or null if they can proceed. Use at the top of a page component:
 *
 *   const guard = usePageGuard('payroll', 'view_payroll');
 *   if (guard) return guard;
 */
export function usePageGuard(moduleKey: ERPModuleKey, permission: string): React.ReactElement | null {
  const { isModuleSubscribed } = useERPModules();
  const { hasPermission } = useAuth();

  if (!isModuleSubscribed(moduleKey)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <ShieldOff className="w-10 h-10 text-orange-400" />
        <p className="font-medium text-lg">Module Not Available</p>
        <p className="text-sm text-center max-w-xs">
          The <strong>{moduleKey.toUpperCase()}</strong> module is not included in your current
          subscription. Contact your administrator to enable it.
        </p>
      </div>
    );
  }

  if (!hasPermission(permission)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <Lock className="w-10 h-10 text-red-400" />
        <p className="font-medium text-lg">Access Denied</p>
        <p className="text-sm text-center max-w-xs">
          You do not have permission to view this page. Contact your administrator if you believe
          this is an error.
        </p>
      </div>
    );
  }

  return null;
}
