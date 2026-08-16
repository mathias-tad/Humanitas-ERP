import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import type { Tenant } from '@/types/tenant';

interface DeleteTenantModalProps {
  tenant: Tenant | null;
  onClose: () => void;
  onConfirm: (tenant: Tenant) => void;
}

export function DeleteTenantModal({ tenant, onClose, onConfirm }: DeleteTenantModalProps) {
  if (!tenant) return null;

  return (
    <Dialog open={!!tenant} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <DialogTitle>Delete Tenant</DialogTitle>
              <DialogDescription>
                This action cannot be undone.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{tenant.company_name}</strong>? This will:
          </p>
          <ul className="mt-3 text-sm text-gray-600 list-disc list-inside space-y-1">
            <li>Remove all {tenant.current_users} users</li>
            <li>Delete the tenant database ({tenant.database_name})</li>
            <li>Remove all attendance and payroll records</li>
            <li>Cancel any active subscriptions</li>
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(tenant)}
          >
            Delete Tenant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
