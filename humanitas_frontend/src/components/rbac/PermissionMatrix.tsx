import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface Permission {
    id: string;
    name: string;
    label: string;
    module: string;
}

interface PermissionMatrixProps {
    permissions: Permission[];
    selectedPermissionIds: string[];
    onTogglePermission: (permissionId: string) => void;
    onToggleModule: (moduleName: string, allSelected: boolean) => void;
    readOnly?: boolean;
}

export function PermissionMatrix({
    permissions,
    selectedPermissionIds,
    onTogglePermission,
    onToggleModule,
    readOnly = false,
}: PermissionMatrixProps) {
    // Group permissions by module
    const groupedPermissions = permissions.reduce((acc, permission) => {
        if (!acc[permission.module]) {
            acc[permission.module] = [];
        }
        acc[permission.module].push(permission);
        return acc;
    }, {} as Record<string, Permission[]>);

    return (
        <div className="space-y-6 p-4 h-full overflow-y-auto">
            {Object.entries(groupedPermissions).map(([module, modulePermissions]) => {
                const selectedCount = modulePermissions.filter((p) =>
                    selectedPermissionIds.includes(p.id)
                ).length;
                const allSelected = selectedCount === modulePermissions.length;
                const isIndeterminate =
                    selectedCount > 0 && selectedCount < modulePermissions.length;

                return (
                    <Card key={module}>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-medium flex items-center gap-2">
                                    {module}
                                    <Badge variant="secondary" className="text-xs font-normal">
                                        {selectedCount}/{modulePermissions.length}
                                    </Badge>
                                </CardTitle>
                                {!readOnly && (
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`select-all-${module}`}
                                            checked={allSelected ? true : isIndeterminate ? "indeterminate" : false}
                                            onCheckedChange={() => onToggleModule(module, allSelected)}
                                        />
                                        <Label
                                            htmlFor={`select-all-${module}`}
                                            className="text-sm text-muted-foreground cursor-pointer"
                                        >
                                            Select All
                                        </Label>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {modulePermissions.map((permission) => (
                                    <div
                                        key={permission.id}
                                        className="flex items-start space-x-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                                    >
                                        <Checkbox
                                            id={permission.id}
                                            checked={selectedPermissionIds.includes(permission.id)}
                                            onCheckedChange={() => onTogglePermission(permission.id)}
                                            disabled={readOnly}
                                        />
                                        <div className="grid gap-1.5 leading-none">
                                            <Label
                                                htmlFor={permission.id}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                            >
                                                {permission.label}
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                {permission.name}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
