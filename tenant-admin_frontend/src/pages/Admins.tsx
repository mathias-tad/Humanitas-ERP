import { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  Mail,
  Shield,
  ShieldCheck,
  Loader2,
  RefreshCw,
  Edit,
  Trash2,
  Ban,
  CheckCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { CreateAdminModal } from '@/components/admins/CreateAdminModal';
import { EditAdminModal } from '@/components/admins/EditAdminModal';

interface Admin {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: 'super_admin' | 'admin' | 'support';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
  by_role: Record<string, number>;
}

const roleColors = {
  super_admin: 'default',
  admin: 'secondary',
  support: 'outline',
} as const;

const roleLabels = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  support: 'Support',
};

export default function Admins() {
  const { user: currentUser } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);

  const isSuperAdmin = currentUser?.role === 'super_admin';
  
  // Filter admins: hide super_admins from non-super_admin users
  const filteredAdmins = isSuperAdmin 
    ? admins 
    : admins.filter(admin => admin.role !== 'super_admin');

  // Check if current user can manage (edit/delete/deactivate) a specific admin
  const canManageAdmin = (admin: Admin) => {
    // Can't manage yourself
    if (admin.id === currentUser?.id) return false;
    // Only super_admin can manage other super_admins
    if (admin.role === 'super_admin' && !isSuperAdmin) return false;
    // Support role can't manage anyone
    if (currentUser?.role === 'support') return false;
    return true;
  };

  const fetchAdmins = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (searchQuery) params.search = searchQuery;

      const [adminsRes, statsRes] = await Promise.all([
        api.get<{ data: Admin[]; total: number }>('/admins', { params }),
        api.get<Stats>('/admins/stats'),
      ]);
      setAdmins(adminsRes.data);
      setStats(statsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch admins');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAdmins();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCreateAdmin = async (data: { email: string; password: string; full_name: string; phone?: string; role: string }) => {
    try {
      await api.post('/admins', data);
      fetchAdmins();
      setIsCreateModalOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create admin');
    }
  };

  const handleUpdateAdmin = async (id: string, data: Partial<Admin & { password?: string }>) => {
    try {
      await api.patch(`/admins/${id}`, data);
      fetchAdmins();
      setEditingAdmin(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update admin');
    }
  };

  const handleDeleteAdmin = async (admin: Admin) => {
    if (!confirm(`Are you sure you want to delete ${admin.full_name}?`)) return;
    try {
      await api.delete(`/admins/${admin.id}`);
      fetchAdmins();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete admin');
    }
  };

  const handleToggleActive = async (admin: Admin) => {
    try {
      if (admin.is_active) {
        await api.patch(`/admins/${admin.id}/deactivate`);
      } else {
        await api.patch(`/admins/${admin.id}/activate`);
      }
      fetchAdmins();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update admin status');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Platform Admins</h1>
            <p className="text-gray-500 mt-1">Manage admin users for the master panel</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={fetchAdmins}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              className="gap-2"
              style={{ backgroundColor: '#2563eb', color: 'white' }}
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add Admin
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-100">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Admins</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.total || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-100">
                  <ShieldCheck className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Active</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.active || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-purple-100">
                  <Shield className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Super Admins</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats?.by_role?.super_admin || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search admins by name or email..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg">{error}</div>
        )}

        {/* Admins Table */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-lg">All Admins ({filteredAdmins.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admin</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAdmins.map((admin) => {
                      const isCurrentUser = admin.id === currentUser?.id;
                      const canManage = canManageAdmin(admin);
                      
                      return (
                        <TableRow key={admin.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className="bg-blue-100 text-blue-700 text-sm">
                                  {getInitials(admin.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {admin.full_name}
                                  {isCurrentUser && <span className="text-xs text-blue-600 ml-2">(You)</span>}
                                </p>
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <Mail className="h-3 w-3" />
                                  {admin.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={roleColors[admin.role]}>{roleLabels[admin.role]}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={admin.is_active ? 'success' : 'secondary'}>
                              {admin.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {admin.last_login_at
                              ? new Date(admin.last_login_at).toLocaleString()
                              : 'Never'}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {new Date(admin.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canManage && (
                                  <DropdownMenuItem onClick={() => setEditingAdmin(admin)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                )}
                                {canManage && <DropdownMenuSeparator />}
                                {canManage && admin.is_active && (
                                  <DropdownMenuItem
                                    className="text-orange-600"
                                    onClick={() => handleToggleActive(admin)}
                                  >
                                    <Ban className="h-4 w-4 mr-2" />
                                    Deactivate
                                  </DropdownMenuItem>
                                )}
                                {canManage && !admin.is_active && (
                                  <DropdownMenuItem
                                    className="text-green-600"
                                    onClick={() => handleToggleActive(admin)}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Activate
                                  </DropdownMenuItem>
                                )}
                                {canManage && (
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() => handleDeleteAdmin(admin)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                )}
                                {!canManage && (
                                  <DropdownMenuItem disabled className="text-gray-400">
                                    No actions available
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {!isLoading && filteredAdmins.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No admins found.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateAdminModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateAdmin}
      />

      <EditAdminModal
        admin={editingAdmin}
        onClose={() => setEditingAdmin(null)}
        onSave={handleUpdateAdmin}
      />
    </>
  );
}
