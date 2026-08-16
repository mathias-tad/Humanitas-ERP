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
}

export function RoleList({
    roles,
    selectedRoleId,
    onSelectRole,
    onCreateRole,
    onEditRole,
    onDeleteRole,
}: RoleListProps) {
    return (
        <div className="flex flex-col h-full bg-background border-r">
            <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold text-lg">Roles</h2>
                <Button size="sm" onClick={onCreateRole}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Role
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
                                : "hover:bg-muted/50"
                        )}
                    >
                        <button
                            onClick={() => onSelectRole(role.id)}
                            className={cn(
                                "w-full text-left px-4 py-3 pr-10 rounded-md transition-colors focus:outline-none focus:bg-muted",
                                selectedRoleId === role.id
                                    ? "text-primary"
                                    : "text-foreground"
                            )}
                        >
                            <div className="font-medium">{role.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
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
                                        onClick={(e) => e.stopPropagation()}
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
                                    >
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteRole(role.id);
                                        }}
                                        className="text-destructive focus:text-destructive"
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
