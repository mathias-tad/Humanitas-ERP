import { useAuth } from '@/context/AuthContext';
import { useERPModules, type ERPModuleKey } from '@/context/ModuleContext';
import { ShieldOff, Lock } from 'lucide-react';
import React from 'react';

export interface PageGuardProps {
  /** Module that must be subscribed for this page to render */
  module?: ERPModuleKey | string;
  moduleKey?: ERPModuleKey | string;
  /** Permission key(s) the current user must have */
  permission?: string;
  permissions?: string[];
  children: React.ReactNode;
}

/**
 * PageGuard — wraps a page with module subscription AND RBAC permission checks.
 * Blocks direct URL navigation if module is disabled or permissions are missing.
 *
 * Usage:
 *   <PageGuard module="payroll" permission="view_payroll">
 *     <RunPayroll />
 *   </PageGuard>
 */
export function PageGuard({
  module,
  moduleKey,
  permission,
  permissions,
  children,
}: PageGuardProps) {
  const { isModuleSubscribed } = useERPModules();
  const { hasPermission, hasAnyPermission, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const targetModule = module || moduleKey;
  if (targetModule && !isModuleSubscribed(targetModule as any)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground p-6">
        <ShieldOff className="w-10 h-10 text-orange-400" />
        <p className="font-medium text-lg text-foreground">Module Not Available</p>
        <p className="text-sm text-center max-w-sm text-muted-foreground">
          The <strong>{targetModule.toUpperCase()}</strong> module is not included in your organization's subscription. Contact your administrator to enable it.
        </p>
      </div>
    );
  }

  // Permission check
  const requiredPermissions = permissions || (permission ? [permission] : []);
  if (requiredPermissions.length > 0) {
    const authorized = permission
      ? hasPermission(permission)
      : hasAnyPermission(requiredPermissions);

    if (!authorized) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground p-6">
          <Lock className="w-10 h-10 text-red-400" />
          <p className="font-medium text-lg text-foreground">Access Denied</p>
          <p className="text-sm text-center max-w-sm text-muted-foreground">
            You do not have the required permissions to view this page. Contact your administrator.
          </p>
        </div>
      );
    }
  }

  return <>{children}</>;
}

/**
 * Hook version — returns a guard element if the user is not authorized,
 * or null if they can proceed.
 */
export function usePageGuard(
  module: ERPModuleKey | string,
  permission?: string,
): React.ReactElement | null {
  const { isModuleSubscribed } = useERPModules();
  const { hasPermission } = useAuth();

  if (!isModuleSubscribed(module as any)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground p-6">
        <ShieldOff className="w-10 h-10 text-orange-400" />
        <p className="font-medium text-lg text-foreground">Module Not Available</p>
        <p className="text-sm text-center max-w-sm text-muted-foreground">
          The <strong>{module.toUpperCase()}</strong> module is not included in your organization's subscription. Contact your administrator to enable it.
        </p>
      </div>
    );
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground p-6">
        <Lock className="w-10 h-10 text-red-400" />
        <p className="font-medium text-lg text-foreground">Access Denied</p>
        <p className="text-sm text-center max-w-sm text-muted-foreground">
          You do not have permission to view this page. Contact your administrator.
        </p>
      </div>
    );
  }

  return null;
}

export default PageGuard;
