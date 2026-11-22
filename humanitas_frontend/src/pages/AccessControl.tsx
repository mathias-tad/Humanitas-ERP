import { useState, useEffect, useMemo } from "react";
import { useERPModules } from "@/context/ModuleContext";
import { useQuery } from "@tanstack/react-query";
import { fetchPermissionCatalog, permissionCatalogKey, visiblePermissions as catalogForTenant } from "@/lib/permissionCatalog";

import { RoleList, type Role } from "@/components/roleAndPermisions/RoleList";
import { CreateEditRoleModal } from "@/components/roleAndPermisions/CreateEditRoleModal";
import {
  PermissionMatrix,
  type Permission,
} from "@/components/roleAndPermisions/PermissionMatrix";
import { DeleteRoleModal } from "@/components/roleAndPermisions/DeleteRoleModal";
import { ShieldCheck, Loader2, RefreshCw, Save } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRolesWithMutations } from "@/hooks/useUsers";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";


function AccessControl() {
  const { hasPermission, user } = useAuth();
  const { isModuleSubscribed } = useERPModules();

  // The server keeps every permission (roles/permission-catalog.ts); only subscribed modules' ones show.
  const catalogQuery = useQuery({
    queryKey: permissionCatalogKey,
    queryFn: fetchPermissionCatalog,
    staleTime: 5 * 60 * 1000,
  });
  const visiblePermissions = useMemo<Permission[]>(
    () => catalogForTenant(catalogQuery.data, (m) => isModuleSubscribed(m)),
    [catalogQuery.data, isModuleSubscribed],
  );

  // Permission checks with explicit Owner bypass
  const isOwner = user?.role?.toLowerCase() === 'owner' || (user as any)?.role_name?.toLowerCase() === 'owner';
  const canCreate = hasPermission("create_roles") || isOwner;
  const canEdit = hasPermission("edit_roles") || isOwner;
  const canDelete = hasPermission("delete_roles") || isOwner;

  // TanStack Query hooks
  const {
    rolesQuery,
    createRoleMutation,
    updateRoleMutation,
    deleteRoleMutation,
    updatePermissionsMutation,
  } = useRolesWithMutations();

  const roles = rolesQuery.data || [];
  const isLoading = rolesQuery.isLoading;

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [isCreateEditModalOpen, setIsCreateEditModalOpen] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState<Role | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [roleToDeleteId, setRoleToDeleteId] = useState<string | null>(null);

  // Local state for permission editing (allows batch changes before saving)
  const [localPermissions, setLocalPermissions] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const selectedRole = roles.find((role) => role.id === selectedRoleId) || null;

  // Sync local permissions when role selection changes
  useEffect(() => {
    if (selectedRole) {
      setLocalPermissions(selectedRole.permissions || []);
      setHasUnsavedChanges(false);
    }
  }, [selectedRole?.id, selectedRole?.permissions]);

  const handleCreateRole = () => {
    setRoleToEdit(null);
    setIsCreateEditModalOpen(true);
  };

  const handleEditRole = (role: Role) => {
    setRoleToEdit(role);
    setIsCreateEditModalOpen(true);
  };

  const handleDeleteRole = (roleId: string) => {
    setRoleToDeleteId(roleId);
    setIsDeleteModalOpen(true);
  };

  const handleSaveRole = (
    id: string | null,
    name: string,
    description: string
  ) => {
    if (id) {
      updateRoleMutation.mutate({ id, data: { name, description } }, {
        onSuccess: () => setIsCreateEditModalOpen(false),
      });
    } else {
      createRoleMutation.mutate({ name, description }, {
        onSuccess: () => setIsCreateEditModalOpen(false),
      });
    }
  };

  const handleConfirmDeleteRole = () => {
    if (roleToDeleteId) {
      deleteRoleMutation.mutate(roleToDeleteId, {
        onSuccess: () => {
          if (selectedRoleId === roleToDeleteId) {
            setSelectedRoleId(null);
          }
          setRoleToDeleteId(null);
          setIsDeleteModalOpen(false);
        },
      });
    }
  };

  // Toggle permission locally (no API call yet)
  const handleTogglePermission = (permissionId: string) => {
    if (!selectedRole || !canEdit) return;

    setLocalPermissions(prev => {
      const newPermissions = prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId];
      return newPermissions;
    });
    setHasUnsavedChanges(true);
  };

  // Toggle entire module locally
  const handleToggleModule = (moduleName: string, allSelected: boolean) => {
    if (!selectedRole || !canEdit) return;

    const modulePermissionIds = visiblePermissions
      .filter((perm) => perm.module === moduleName)
      .map((perm) => perm.id);

    setLocalPermissions(prev => {
      let newPermissions = [...prev];
      if (allSelected) {
        newPermissions = newPermissions.filter((id) => !modulePermissionIds.includes(id));
      } else {
        const permsToAdd = modulePermissionIds.filter((id) => !newPermissions.includes(id));
        newPermissions = [...newPermissions, ...permsToAdd];
      }
      return newPermissions;
    });
    setHasUnsavedChanges(true);
  };

  // Save changes to server
  const handleSavePermissions = () => {
    if (!selectedRole || !hasUnsavedChanges) return;

    updatePermissionsMutation.mutate(
      { id: selectedRole.id, permissions: localPermissions },
      {
        onSuccess: () => {
          setHasUnsavedChanges(false);
          toast.success("Permissions saved successfully!");
        },
        onError: () => {
          toast.error("Failed to save permissions");
        },
      }
    );
  };

  // Discard local changes
  const handleDiscardChanges = () => {
    if (selectedRole) {
      setLocalPermissions(selectedRole.permissions || []);
      setHasUnsavedChanges(false);
    }
  };

  return (
    <>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Access Control
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage roles and permissions for system access.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => rolesQuery.refetch()}
            disabled={rolesQuery.isRefetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${rolesQuery.isRefetching ? 'animate-spin' : ''}`} />
            {rolesQuery.isRefetching ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-64 md:w-80 flex-shrink-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <RoleList
                roles={roles}
                selectedRoleId={selectedRoleId}
                onCreateRole={handleCreateRole}
                onSelectRole={(roleId) => {
                  // Warn if unsaved changes
                  if (hasUnsavedChanges) {
                    if (!confirm("You have unsaved changes. Discard and switch role?")) {
                      return;
                    }
                  }
                  setSelectedRoleId(roleId);
                }}
                onEditRole={handleEditRole}
                onDeleteRole={handleDeleteRole}
                canCreate={canCreate}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            )}
          </aside>

          <main className="flex-1 flex flex-col min-w-0 bg-muted/10">
            {selectedRole ? (
              <div className="flex flex-col h-full">
                <div className="px-6 py-4 border-b bg-primary/5 border-primary/20 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`h-2 w-2 rounded-full ${hasUnsavedChanges ? 'bg-amber-500' : 'bg-primary'} animate-pulse`} />
                      <span className="text-xs font-medium text-primary uppercase tracking-wide">
                        {hasUnsavedChanges ? 'Unsaved Changes' : 'Editing Role'}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-foreground">
                      {selectedRole.name}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedRole.description}
                    </p>
                  </div>

                  {/* Save / Discard Buttons */}
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      {hasUnsavedChanges && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDiscardChanges}
                          disabled={updatePermissionsMutation.isPending}
                        >
                          Discard
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={handleSavePermissions}
                        disabled={!hasUnsavedChanges || updatePermissionsMutation.isPending}
                      >
                        {updatePermissionsMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
                <PermissionMatrix
                  permissions={visiblePermissions}
                  selectedPermissionIds={localPermissions}
                  onTogglePermission={handleTogglePermission}
                  onToggleModule={handleToggleModule}
                  disabled={!canEdit || updatePermissionsMutation.isPending}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a role to view permissions.
              </div>
            )}
          </main>
        </div>
      </div>
      <CreateEditRoleModal
        isOpen={isCreateEditModalOpen}
        onClose={() => setIsCreateEditModalOpen(false)}
        onSave={handleSaveRole}
        role={roleToEdit}
      />
      <DeleteRoleModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDeleteRole}
        roleName={roles.find((role) => role.id === roleToDeleteId)?.name || ""}
      />
    </>
  );
}
export default AccessControl;
