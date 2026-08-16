import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import type { Tenant } from '@/types/tenant';

interface SuspendTenantModalProps {
  tenant: Tenant | null;
  onClose: () => void;
  onConfirm: (tenant: Tenant, reason: string, notes: string) => void;
}

const suspensionReasons = [
  { value: 'policy_violation', label: 'Policy Violation' },
  { value: 'security_concern', label: 'Security Concern' },
  { value: 'abuse_detected', label: 'Abuse Detected' },
  { value: 'legal_compliance', label: 'Legal/Compliance Issue' },
  { value: 'customer_request', label: 'Customer Request' },
  { value: 'non_payment', label: 'Non-Payment (Manual)' },
  { value: 'maintenance', label: 'Maintenance/Investigation' },
  { value: 'other', label: 'Other' },
];

export function SuspendTenantModal({ tenant, onClose, onConfirm }: SuspendTenantModalProps) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  if (!tenant) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason) {
      onConfirm(tenant, reason, notes);
      setReason('');
      setNotes('');
    }
  };

  return (
    <Dialog open={!!tenant} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-orange-100">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <DialogTitle>Suspend Tenant</DialogTitle>
              <DialogDescription>
                This will immediately disable access for all users.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4 space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Suspending <strong>{tenant.company_name}</strong> ({tenant.current_users} users)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Suspension Reason *</Label>
              <Select value={reason} onValueChange={setReason} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {suspensionReasons.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <textarea
                id="notes"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Add any additional details about this suspension..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="p-3 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>What happens when suspended:</strong>
              </p>
              <ul className="text-sm text-orange-700 list-disc list-inside mt-2 space-y-1">
                <li>All users will be logged out immediately</li>
                <li>Login attempts will be blocked</li>
                <li>API access will be disabled</li>
                <li>Device connections will be rejected</li>
                <li>Data will be preserved (not deleted)</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-orange-600 hover:bg-orange-700"
              disabled={!reason}
            >
              Suspend Tenant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ReactivateTenantModalProps {
  tenant: Tenant | null;
  onClose: () => void;
  onConfirm: (tenant: Tenant, notes: string) => void;
}

export function ReactivateTenantModal({ tenant, onClose, onConfirm }: ReactivateTenantModalProps) {
  const [notes, setNotes] = useState('');

  if (!tenant) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(tenant, notes);
    setNotes('');
  };

  return (
    <Dialog open={!!tenant} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <DialogTitle>Reactivate Tenant</DialogTitle>
              <DialogDescription>
                Restore access for this suspended tenant.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4 space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Reactivating <strong>{tenant.company_name}</strong> ({tenant.current_users} users)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Reactivation Notes</Label>
              <textarea
                id="notes"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Add any notes about this reactivation..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>What happens when reactivated:</strong>
              </p>
              <ul className="text-sm text-green-700 list-disc list-inside mt-2 space-y-1">
                <li>Users can log in again</li>
                <li>API access will be restored</li>
                <li>Device connections will be accepted</li>
                <li>All data remains intact</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              style={{ backgroundColor: '#16a34a', color: 'white' }}
            >
              Reactivate Tenant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
