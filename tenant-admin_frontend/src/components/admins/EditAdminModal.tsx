import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';

interface Admin {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: 'super_admin' | 'admin' | 'support';
  is_active: boolean;
}

interface EditAdminModalProps {
  admin: Admin | null;
  onClose: () => void;
  onSave: (id: string, data: Partial<Admin & { password?: string }>) => void;
}

export function EditAdminModal({ admin, onClose, onSave }: EditAdminModalProps) {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    role: 'admin' as Admin['role'],
    password: '',
  });

  useEffect(() => {
    if (admin) {
      setFormData({
        email: admin.email,
        full_name: admin.full_name,
        phone: admin.phone || '',
        role: admin.role,
        password: '',
      });
    }
  }, [admin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin) return;

    const data: Partial<Admin & { password?: string }> = {
      email: formData.email,
      full_name: formData.full_name,
      phone: formData.phone || undefined,
      role: formData.role,
    };

    if (formData.password) {
      data.password = formData.password;
    }

    onSave(admin.id, data);
  };

  if (!admin) return null;

  return (
    <Dialog open={!!admin} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Admin</DialogTitle>
          <DialogDescription>
            Update admin user details. Leave password empty to keep current.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_full_name">Full Name *</Label>
              <Input
                id="edit_full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_email">Email *</Label>
              <Input
                id="edit_email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_password">New Password</Label>
              <Input
                id="edit_password"
                type="password"
                placeholder="Leave empty to keep current"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_phone">Phone</Label>
              <Input
                id="edit_phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value: Admin['role']) => setFormData({ ...formData, role: value })}
                disabled={admin?.role === 'super_admin' && !isSuperAdmin}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" style={{ backgroundColor: '#2563eb', color: 'white' }}>
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
