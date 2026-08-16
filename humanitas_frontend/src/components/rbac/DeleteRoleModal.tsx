import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface DeleteRoleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    roleName: string;
}

export function DeleteRoleModal({
    isOpen,
    onClose,
    onConfirm,
    roleName,
}: DeleteRoleModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                            <DialogTitle>Delete Role</DialogTitle>
                            <DialogDescription className="mt-1">
                                This action cannot be undone.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                <div className="py-4">
                    <p className="text-sm text-muted-foreground">
                        Are you sure you want to delete the role{" "}
                        <span className="font-semibold text-foreground">{roleName}</span>?
                        This will remove all associated permissions.
                    </p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={onConfirm}>
                        Delete Role
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
