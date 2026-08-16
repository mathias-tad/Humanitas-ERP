import { useAuth } from '@/context/AuthContext';

export function usePermissions() {
    const { hasAnyPermission } = useAuth();

    const hasPermission = (permission: string): boolean => {
        return hasAnyPermission([permission]);
    };

    const hasAllPermissions = (permissions: string[]): boolean => {
        return permissions.every(p => hasAnyPermission([p]));
    };

    return {
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
    };
}
