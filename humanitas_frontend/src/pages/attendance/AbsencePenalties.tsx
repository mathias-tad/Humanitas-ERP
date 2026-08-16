
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/config/api.config";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner"; // Assuming sonner is used, or useToast

export function AbsencePenalties() {
    const { hasPermission } = useAuth();
    const queryClient = useQueryClient();
    const [rejectId, setRejectId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

    // Fetch Pending Penalties
    const { data: penalties = [], isLoading } = useQuery({
        queryKey: ["absence-penalties", "pending"],
        queryFn: async () => {
            const response = await fetch(`${API_BASE_URL}/absence-penalty/pending`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`, // Start with simple token retrieval
                },
            });
            if (!response.ok) throw new Error("Failed to fetch penalties");
            return response.json();
        },
        enabled: !!hasPermission("absence_penalty_approve"),
    });

    // Approve Mutation
    const approveMutation = useMutation({
        mutationFn: async (id: string) => {
            const response = await fetch(`${API_BASE_URL}/absence-penalty/${id}/approve`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });
            if (!response.ok) throw new Error("Failed to approve penalty");
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["absence-penalties"] });
            toast.success("Penalty approved successfully");
        },
        onError: (error) => {
            toast.error(`Error: ${error.message}`);
        }
    });

    // Reject Mutation
    const rejectMutation = useMutation({
        mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
            const response = await fetch(`${API_BASE_URL}/absence-penalty/${id}/reject`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({ reason }),
            });
            if (!response.ok) throw new Error("Failed to reject penalty");
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["absence-penalties"] });
            setIsRejectModalOpen(false);
            setRejectId(null);
            setRejectReason("");
            toast.success("Penalty rejected");
        },
        onError: (error) => {
            toast.error(`Error: ${error.message}`);
        }
    });

    const handleApprove = (id: string) => {
        if (confirm("Are you sure you want to approve this penalty? It will be deducted from payroll.")) {
            approveMutation.mutate(id);
        }
    };

    const handleRejectClick = (id: string) => {
        setRejectId(id);
        setIsRejectModalOpen(true);
    };

    const submitReject = () => {
        if (!rejectId || !rejectReason) return;
        rejectMutation.mutate({ id: rejectId, reason: rejectReason });
    };

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Absence Penalty Approvals</CardTitle>
                <CardDescription>Review and approve automatic absence penalties before they are applied to payroll.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Date Created</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {penalties.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                    No pending penalties found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            penalties.map((p: any) => (
                                <TableRow key={p.id}>
                                    <TableCell>
                                        <div>
                                            <p className="font-medium">{p.full_name}</p>
                                            <p className="text-xs text-gray-500">{p.department} - {p.position}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                                    <TableCell className="font-semibold text-red-600">
                                        {parseFloat(p.amount).toLocaleString()} ETB
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={p.reason}>{p.reason}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                            {p.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                onClick={() => handleApprove(p.id)}
                                                disabled={approveMutation.isPending}
                                            >
                                                <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleRejectClick(p.id)}
                                            >
                                                <XCircle className="w-4 h-4 mr-1" /> Reject
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>

            <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Penalty</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto" />
                        <p className="text-center text-sm text-gray-600">
                            You are about to reject this penalty. The amount will <strong>NOT</strong> be deducted from payroll.
                            Please provide a reason.
                        </p>
                        <Textarea
                            placeholder="Reason for rejection..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRejectModalOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={submitReject} disabled={rejectMutation.isPending}>
                            Confirm Rejection
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
