import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  UserPlus,
  Search,
  MoreVertical,
  Mail,
  Phone,
  Calendar,
  CheckCircle,
  XCircle,
  Users,
  UserCheck,
  UserX,
  Loader2,
  Pencil,
  Trash2,
  Eye,
  PauseCircle,
  PlayCircle,
  Paperclip,
  FileText,
  File,
  Download,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { type User, useUsers, useRoles } from "@/hooks/useUsers";
import { API_BASE_URL, getUploadUrl } from "@/config/api.config";
import { usePresence } from "@/context/PresenceContext";
import { UserModal } from "@/components/users/UserModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Local interfaces removed in favor of @/hooks/useUsers types

const getStatusColor = (isActive: boolean) => {
  return isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800";
};

const getStatusIcon = (isActive: boolean) => {
  return isActive ? (
    <CheckCircle className="h-4 w-4 text-green-600" />
  ) : (
    <XCircle className="h-4 w-4 text-gray-600" />
  );
};

function Accounts() {
  const { hasPermission } = useAuth();
  const { isUserOnline } = usePresence();

  // Permission checks
  const canCreate = hasPermission("create_users");
  const canEdit = hasPermission("edit_users");
  const canDelete = hasPermission("delete_users");
  const canViewAttachments = hasPermission("view_user_attachments");
  const canManageAttachments = hasPermission("manage_user_attachments");

  const getHeaders = (includeContentType = false) => {
    const headers: Record<string, string> = {};
    if (includeContentType) headers['Content-Type'] = 'application/json';
    return headers;
  };

  const queryClient = useQueryClient();
  const { data: users = [], isLoading: isLoadingUsers } = useUsers();
  const { data: roles = [] } = useRoles();

  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<"delete" | "suspend" | "activate" | null>(null);

  const [attachmentsUser, setAttachmentsUser] = useState<User | null>(null);
  // attachments, isLoadingAttachments, isUploading are now from query/mutation
  const [uploadCategory, setUploadCategory] = useState("other");
  const [uploadDescription, setUploadDescription] = useState("");

  const isLoading = isLoadingUsers;

  const saveUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const isEdit = !!userData.id;
      const payload = isEdit ? { ...userData, id: undefined } : userData;
      const response = await fetch(
        `${API_BASE_URL}/users${isEdit ? `/${userData.id}` : ""}`,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: getHeaders(true),
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsModalOpen(false);
      setEditingUser(null);
      toast.success("User saved successfully");
    },
    onError: (error: Error) => {
      console.error(error);
      toast.error(error.message || "Failed to save user");
    }
  });

  const handleSaveUser = async (userData: any) => {
    // Pass the ID if editing, so mutationFn knows
    await saveUserMutation.mutateAsync({ ...userData, id: editingUser?.id });
  };

  const userActionMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string, type: "delete" | "suspend" | "activate" }) => {
      let url = `${API_BASE_URL}/users/${id}`;
      let method = "DELETE";
      let body = null;

      if (type === "delete") {
        url += "?permanent=true";
      } else if (type === "suspend") {
        url += "?permanent=false";
      } else if (type === "activate") {
        method = "PATCH";
        body = JSON.stringify({ is_active: true });
      }

      const response = await fetch(url, {
        method: method,
        credentials: 'include',
        headers: getHeaders(!!body),
        body: body
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Action failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteUserId(null);
      setActionType(null);
    },
    onError: (error) => {
      console.error(error);
    }
  });

  const handleUserAction = () => {
    if (!deleteUserId || !actionType) return;
    userActionMutation.mutate({ id: deleteUserId, type: actionType });
  };

  // Attachment functions
  const {
    data: attachments = [],
    isLoading: isLoadingAttachments
  } = useQuery<any[]>({
    queryKey: ['user-attachments', attachmentsUser?.id],
    queryFn: () => fetch(`${API_BASE_URL}/users/${attachmentsUser?.id}/attachments`, {
      headers: getHeaders(),
      credentials: 'include',
    }).then(res => res.json()),
    enabled: !!attachmentsUser,
  });

  const openAttachmentsModal = (user: User) => {
    setAttachmentsUser(user);
  };




  const uploadAttachmentMutation = useMutation({
    mutationFn: async ({ file, category, description }: { file: File, category: string, description: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      formData.append("description", description);

      const response = await fetch(`${API_BASE_URL}/users/${attachmentsUser?.id}/attachments`, {
        method: "POST",
        headers: getHeaders(),
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-attachments', attachmentsUser?.id] });
      setUploadCategory("other");
      setUploadDescription("");
    }
  });

  const isUploadingAttachment = uploadAttachmentMutation.isPending;

  const handleUploadAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !attachmentsUser) return;
    uploadAttachmentMutation.mutate({ file, category: uploadCategory, description: uploadDescription });
    e.target.value = "";
  };

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const response = await fetch(`${API_BASE_URL}/users/attachments/${attachmentId}`, {
        method: "DELETE",
        headers: getHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error("Failed to delete attachment");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-attachments', attachmentsUser?.id] });
    }
  });

  const handleDeleteAttachment = (attachmentId: string) => {
    if (!confirm("Are you sure you want to delete this attachment?")) return;
    deleteAttachmentMutation.mutate(attachmentId);
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.position?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: users.length,
    active: users.filter((u) => u.is_active).length,
    inactive: users.filter((u) => !u.is_active).length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">User Accounts</h1>
            <p className="text-gray-500 mt-1">
              Manage employee accounts and access
            </p>
          </div>
          <Button
            style={{ backgroundColor: "#2563eb", color: "white" }}
            className="gap-2"
            onClick={() => {
              setEditingUser(null);
              setIsModalOpen(true);
            }}
            disabled={!canCreate}
          >
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="py-3">
            <CardContent className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Users</p>
                <p className="text-2xl font-bold text-foreground">
                  {stats.total}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-3">
            <CardContent className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100">
                <UserCheck className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-2xl font-bold text-foreground">
                  {stats.active}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-3">
            <CardContent className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-gray-100">
                <UserX className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Inactive</p>
                <p className="text-2xl font-bold text-foreground">
                  {stats.inactive}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search Bar */}
        <Card>
          <CardContent className="py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, department, or position..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-lg">
              All Users ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role & Department</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Join Date</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            {user.avatar_url ? (
                              <img
                                src={getUploadUrl(user.avatar_url)}
                                alt={user.full_name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-blue-600 font-semibold text-sm">
                                  {user.full_name
                                    ?.split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase() || "?"}
                                </span>
                              </div>
                            )}
                            <span
                              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${isUserOnline(user.id) ? "bg-green-500" : "bg-gray-300"
                                }`}
                              title={isUserOnline(user.id) ? "Online" : "Offline"}
                            />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {user.full_name}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.role_name || "No Role"}
                          </p>
                          <p className="text-sm text-gray-500">
                            {user.department || "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Phone className="h-3 w-3" />
                          {user.phone || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Calendar className="h-3 w-3" />
                          {user.hire_date
                            ? new Date(user.hire_date).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )
                            : "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.last_login ? (
                          <span className="text-sm text-gray-600">
                            {new Date(user.last_login).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}{" "}
                            {new Date(user.last_login).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400 italic">
                            Never
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`${getStatusColor(
                            user.is_active
                          )} flex items-center gap-1 w-fit`}
                        >
                          {getStatusIcon(user.is_active)}
                          <span>{user.is_active ? "Active" : "Inactive"}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <MoreVertical className="h-4 w-4 text-gray-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingUser(user)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingUser(user);
                                setIsModalOpen(true);
                              }}
                              disabled={!canEdit}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openAttachmentsModal(user)}
                              disabled={!canViewAttachments}
                            >
                              <Paperclip className="h-4 w-4 mr-2" />
                              Attachments
                            </DropdownMenuItem>
                            {user.is_active ? (
                              <DropdownMenuItem
                                className="text-orange-600"
                                onClick={() => {
                                  setDeleteUserId(user.id);
                                  setActionType("suspend");
                                }}
                                disabled={!canEdit}
                              >
                                <PauseCircle className="h-4 w-4 mr-2" />
                                Suspend
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-green-600"
                                onClick={() => {
                                  setDeleteUserId(user.id);
                                  setActionType("activate");
                                }}
                                disabled={!canEdit}
                              >
                                <PlayCircle className="h-4 w-4 mr-2" />
                                Activate
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                setDeleteUserId(user.id);
                                setActionType("delete");
                              }}
                              disabled={!canDelete}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Permanently
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filteredUsers.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                {users.length === 0
                  ? "No users found. Add your first user to get started."
                  : "No users found matching your search criteria."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User Modal */}
      <UserModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUser(null);
        }}
        onSave={handleSaveUser}
        user={editingUser}
        roles={roles}
      />

      {/* View Details Modal */}
      <Dialog open={!!viewingUser} onOpenChange={() => setViewingUser(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {viewingUser && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                {viewingUser.avatar_url ? (
                  <img
                    src={getUploadUrl(viewingUser.avatar_url)}
                    alt={viewingUser.full_name}
                    className="w-20 h-20 rounded-full object-cover border-2 border-gray-100"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl text-primary font-bold">
                    {viewingUser.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold text-foreground">{viewingUser.full_name}</h3>
                  <p className="text-gray-500 flex items-center gap-1">
                    <Mail className="h-4 w-4" /> {viewingUser.email}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline">{viewingUser.role_name}</Badge>
                    <Badge className={getStatusColor(viewingUser.is_active)}>
                      {viewingUser.is_active ? "Active" : "Suspended"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Employment Info */}
              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Department</p>
                  <p className="text-foreground">{viewingUser.department || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Position</p>
                  <p className="text-foreground">{viewingUser.position || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Employment Type</p>
                  <p className="text-gray-900 capitalize">{viewingUser.employment_type?.replace('_', '-') || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Hire Date</p>
                  <p className="text-foreground">
                    {viewingUser.hire_date ? new Date(viewingUser.hire_date).toLocaleDateString() : "-"}
                  </p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p className="text-foreground">{viewingUser.phone || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Date of Birth</p>
                  <p className="text-foreground">
                    {viewingUser.birth_date ? new Date(viewingUser.birth_date).toLocaleDateString() : "-"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-500">Address</p>
                  <p className="text-foreground">
                    {[viewingUser.address, viewingUser.city, viewingUser.state, viewingUser.country, viewingUser.postal_code]
                      .filter(Boolean).join(', ') || "-"}
                  </p>
                </div>
              </div>

              {/* Emergency Contact */}
              {viewingUser.emergency_contact_name && (
                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-gray-500 mb-2">Emergency Contact</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Name</p>
                    <p className="text-foreground">{viewingUser.emergency_contact_name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Phone</p>
                    <p className="text-foreground">{viewingUser.emergency_contact_phone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Relationship</p>
                    <p className="text-gray-900 capitalize">{viewingUser.emergency_contact_relationship || "-"}</p>
                  </div>
                </div>
              )}

              {/* System Info */}
              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Join Date</p>
                  <p className="text-foreground">
                    {viewingUser.hire_date
                      ? new Date(viewingUser.hire_date).toLocaleDateString()
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Account Created</p>
                  <p className="text-foreground">
                    {new Date(viewingUser.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Last Login</p>
                  <p className="text-foreground">
                    {viewingUser.last_login
                      ? new Date(viewingUser.last_login).toLocaleString()
                      : "Never logged in"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "delete" && "Delete User Permanently"}
              {actionType === "suspend" && "Suspend User Account"}
              {actionType === "activate" && "Activate User Account"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "delete" && "Are you sure you want to permanently delete this user? This action cannot be undone and all user data will be lost."}
              {actionType === "suspend" && "Are you sure you want to suspend this user? They will no longer be able to log in to the system."}
              {actionType === "activate" && "Are you sure you want to activate this user? They will be able to log in again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUserAction}
              className={
                actionType === "delete"
                  ? "bg-red-600 hover:bg-red-700"
                  : actionType === "suspend"
                    ? "bg-orange-600 hover:bg-orange-700"
                    : "bg-green-600 hover:bg-green-700"
              }
            >
              {actionType === "delete" && "Delete Permanently"}
              {actionType === "suspend" && "Suspend Account"}
              {actionType === "activate" && "Activate Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Attachments Modal */}
      <Dialog open={!!attachmentsUser} onOpenChange={() => setAttachmentsUser(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Attachments - {attachmentsUser?.full_name}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Upload Section - Only for users with manage permission */}
            {canManageAttachments && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload New Document
                </h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-sm font-medium">Category</label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      className="w-full mt-1 p-2 border rounded-md text-sm"
                    >
                      <option value="cv">CV / Resume</option>
                      <option value="id_document">ID Document</option>
                      <option value="contract">Contract</option>
                      <option value="certificate">Certificate</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description (optional)</label>
                    <input
                      type="text"
                      value={uploadDescription}
                      onChange={(e) => setUploadDescription(e.target.value)}
                      placeholder="Brief description"
                      className="w-full mt-1 p-2 border rounded-md text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    id="attachment-upload"
                    className="hidden"
                    onChange={handleUploadAttachment}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('attachment-upload')?.click()}
                    disabled={isUploadingAttachment}
                  >
                    {isUploadingAttachment ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Select File
                      </>
                    )}
                  </Button>
                  <span className="text-xs text-gray-500">
                    PDF, DOC, DOCX, JPG, PNG (Max 5MB)
                  </span>
                </div>
              </div>
            )}

            {/* Attachments List */}
            {isLoadingAttachments ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : attachments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No documents uploaded for this user.
              </p>
            ) : (
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded">
                        {attachment.file_type?.includes('pdf') ? (
                          <FileText className="h-5 w-5 text-blue-600" />
                        ) : (
                          <File className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{attachment.original_name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="capitalize">{attachment.category?.replace('_', ' ')}</span>
                          <span>•</span>
                          <span>{(attachment.file_size / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span>{new Date(attachment.created_at).toLocaleDateString()}</span>
                          {attachment.uploaded_by_name && (
                            <>
                              <span>•</span>
                              <span>by {attachment.uploaded_by_name}</span>
                            </>
                          )}
                        </div>
                        {attachment.description && (
                          <p className="text-xs text-gray-400 mt-1">{attachment.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <a
                        href={`${API_BASE_URL.replace('/api/v1', '')}${attachment.file_path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-gray-100 rounded"
                        title="Download"
                      >
                        <Download className="h-4 w-4 text-gray-600" />
                      </a>
                      {canManageAttachments && (
                        <button
                          onClick={() => handleDeleteAttachment(attachment.id)}
                          className="p-2 hover:bg-red-100 rounded text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default Accounts;
