import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface MemberFormData {
    id?: string;
    full_name: string;
    email: string;
    role: string;
    password?: string;
}

interface AddMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: MemberFormData) => void;
    member?: MemberFormData | null;
}

export function AddMemberModal({
    isOpen,
    onClose,
    onSave,
    member,
}: AddMemberModalProps) {
    const [formData, setFormData] = useState<MemberFormData>({
        full_name: "",
        email: "",
        role: "employee",
        password: "",
    });

    useEffect(() => {
        if (member) {
            setFormData({
                ...member,
                password: "",
            });
        } else {
            setFormData({
                full_name: "",
                email: "",
                role: "employee",
                password: "",
            });
        }
    }, [member, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{member ? "Edit Member" : "Add New Member"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="full_name">Full Name</Label>
                        <Input
                            id="full_name"
                            value={formData.full_name}
                            onChange={(e) =>
                                setFormData({ ...formData, full_name: e.target.value })
                            }
                            placeholder="John Doe"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) =>
                                setFormData({ ...formData, email: e.target.value })
                            }
                            placeholder="john@example.com"
                            required
                        />
                    </div>
                    {!member && (
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={formData.password}
                                onChange={(e) =>
                                    setFormData({ ...formData, password: e.target.value })
                                }
                                placeholder="Min 8 characters"
                                required={!member}
                                minLength={8}
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select
                            value={formData.role}
                            onValueChange={(value) => setFormData({ ...formData, role: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="employee">Employee</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="!bg-primary hover:!bg-primary/90 !text-primary-foreground">
                            {member ? "Save Changes" : "Invite Member"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
