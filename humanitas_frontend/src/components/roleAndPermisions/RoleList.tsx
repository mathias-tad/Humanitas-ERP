import { Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

interface RoleListProps {
  roles: Role[];
  selectedRoleId: string | null;
  onSelectRole: (roleId: string) => void;
  onCreateRole: () => void;
  onEditRole: (role: Role) => void;
  onDeleteRole: (roleId: string) => void;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function RoleList({
  roles,
  selectedRoleId,
  onSelectRole,
  onCreateRole,
  onEditRole,
  onDeleteRole,
  canCreate = true,
  canEdit = true,
  canDelete = true,
}: RoleListProps) {
  return (
    <div className="flex flex-col h-full bg-background border-r">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">Roles</h2>
        <Button size={"sm"} onClick={onCreateRole} disabled={!canCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Role
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {roles.map((role) => (
          <div
            key={role.id}
            className={cn(
              "group w-full rounded-md transition-colors relative",
              selectedRoleId === role.id
                ? "bg-primary/10"
                : "hover:bg-accent/50 cursor-pointer"
            )}
          >
            <button
              onClick={() => onSelectRole(role.id)}
              className={cn(
                "w-full text-left px-4 py-3 pr-10 rounded-md transition-colors focus:outline-none focus:bg-muted",
                selectedRoleId === role.id ? "text-primary" : "text-foreground"
              )}
            >
              <div className="font-medium">{role.name}</div>
              <div className="text-sm text-muted-foreground truncate">
                {role.description}
              </div>
            </button>
            <div className="absolute top-2 right-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditRole(role);
                    }}
                    disabled={!canEdit}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRole(role.id);
                    }}
                    disabled={!canDelete}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
