import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import type { Tenant } from '@/types/tenant';

interface DeleteTenantModalProps {
  tenant: Tenant | null;
  onClose: () => void;
  onConfirm: (tenant: Tenant) => void;
}

/** Days a deleted tenant is kept (and restorable) before it can be purged; matches the API. */
const RETENTION_DAYS = 30;

export function DeleteTenantModal({ tenant, onClose, onConfirm }: DeleteTenantModalProps) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    setTyped('');
  }, [tenant?.id]);

  if (!tenant) return null;

  const confirmed = typed.trim() === tenant.slug;

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
                Can be restored for {RETENTION_DAYS} days. Super admins only.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-gray-600">
            Deleting <strong>{tenant.company_name}</strong> will:
          </p>
          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
            <li>Immediately block all {tenant.current_users} users from signing in</li>
            <li>Keep its database ({tenant.database_name}) for {RETENTION_DAYS} days so it can be restored</li>
            <li>Allow permanent deletion only after those {RETENTION_DAYS} days</li>
          </ul>
          <div className="space-y-2">
            <Label htmlFor="confirm-tenant-slug">
              Type <code className="px-1 rounded bg-gray-100">{tenant.slug}</code> to confirm
            </Label>
            <Input
              id="confirm-tenant-slug"
              value={typed}
              autoComplete="off"
              onChange={(e) => setTyped(e.target.value)}
              placeholder={tenant.slug}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!confirmed} onClick={() => onConfirm(tenant)}>
            Delete Tenant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
