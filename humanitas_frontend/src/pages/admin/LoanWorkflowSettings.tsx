import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Settings, Save, ArrowUp, ArrowDown } from "lucide-react";
import { API_BASE_URL } from "@/config/api.config";

interface WorkflowStep {
    id?: string;
    step_order: number;
    role_required: string;
    is_final: boolean;
}

export default function LoanWorkflowSettings() {
    const [steps, setSteps] = useState<WorkflowStep[]>([]);
    const [availableRoles, setAvailableRoles] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchWorkflow();
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/payroll/loans/workflow/roles`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setAvailableRoles(data.map((r: any) => r.name));
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to load roles");
        }
    };

    const fetchWorkflow = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/payroll/loans/workflow/config`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                if (data.length === 0) {
                    // Default to empty workflow
                    setSteps([]);
                } else {
                    setSteps(data);
                }
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to load workflow");
        } finally {
            setLoading(false);
        }
    };

    const addStep = () => {
        const defaultRole = availableRoles.length > 0 ? availableRoles[0] : 'Manager';
        const newStep: WorkflowStep = {
            step_order: steps.length + 1,
            role_required: defaultRole,
            is_final: steps.length === 0 // First step is final by default
        };
        setSteps([...steps, newStep]);
    };



    const removeStep = (index: number) => {
        const newSteps = steps.filter((_, i) => i !== index);
        // Reorder
        setSteps(newSteps.map((s, i) => ({ ...s, step_order: i + 1 })));
    };

    const moveStep = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === steps.length - 1) return;

        const newSteps = [...steps];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        [newSteps[index], newSteps[swapIndex]] = [newSteps[swapIndex], newSteps[index]];

        // Reorder
        setSteps(newSteps.map((s, i) => ({ ...s, step_order: i + 1 })));
    };

    const updateStep = (index: number, field: keyof WorkflowStep, value: any) => {
        const newSteps = [...steps];
        newSteps[index] = { ...newSteps[index], [field]: value };
        setSteps(newSteps);
    };

    const handleSave = async () => {
        if (steps.length === 0) {
            toast.error("Add at least one approval step");
            return;
        }

        // Ensure last step is marked as final
        const finalSteps = steps.map((s, i) => ({
            ...s,
            is_final: i === steps.length - 1
        }));

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/payroll/loans/workflow/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ steps: finalSteps }),
            });

            if (res.ok) {
                toast.success('Workflow saved successfully');
                fetchWorkflow();
            } else {
                const error = await res.json();
                toast.error(error.message || 'Failed to save workflow');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to save workflow');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Delete the approval workflow? Loans will revert to single-step approval.")) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/payroll/loans/workflow/config`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (res.ok) {
                toast.success('Workflow deleted. Single-step approval enabled.');
                setSteps([]);
            } else {
                const error = await res.json();
                toast.error(error.message || 'Failed to delete workflow');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete workflow');
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Loan Approval Workflow</h1>
                    <p className="text-muted-foreground mt-2">
                        Configure multi-step approval hierarchy for loan requests.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Approval Steps Configuration
                    </CardTitle>
                    <CardDescription>
                        Define the approval steps required for loan requests. Steps are processed in order.
                        If no workflow is configured, all loans require single-step admin approval.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        {steps.map((step, index) => (
                            <div key={index} className="flex items-center gap-4 p-4 border rounded-lg bg-gray-50">
                                <div className="flex flex-col gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => moveStep(index, 'up')}
                                        disabled={index === 0}
                                        className="h-6 w-6 p-0"
                                    >
                                        <ArrowUp className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => moveStep(index, 'down')}
                                        disabled={index === steps.length - 1}
                                        className="h-6 w-6 p-0"
                                    >
                                        <ArrowDown className="h-3 w-3" />
                                    </Button>
                                </div>

                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-bold">
                                    {index + 1}
                                </div>

                                <div className="flex-1 grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Role Required</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                                            value={step.role_required}
                                            onChange={(e) => updateStep(index, 'role_required', e.target.value)}
                                        >
                                            {availableRoles.map(role => (
                                                <option key={role} value={role}>{role}</option>
                                            ))}
                                            {availableRoles.length === 0 && (
                                                <option value="" disabled>Loading roles...</option>
                                            )}
                                        </select>
                                    </div>

                                    <div className="flex items-end">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            {index === steps.length - 1 && (
                                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                    Final Step
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeStep(index)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}

                        {steps.length === 0 && (
                            <div className="text-center py-12 border-2 border-dashed rounded-lg">
                                <Settings className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                <p className="text-muted-foreground">No approval workflow configured.</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Loans will require single-step admin approval.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={addStep} variant="outline">
                            <Plus className="h-4 w-4 mr-2" /> Add Step
                        </Button>
                        {steps.length > 0 && (
                            <>
                                <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                                    <Save className="h-4 w-4 mr-2" /> Save Workflow
                                </Button>
                                <Button onClick={handleDelete} disabled={loading} variant="destructive">
                                    <Trash2 className="h-4 w-4 mr-2" /> Delete Workflow
                                </Button>
                            </>
                        )}
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm">
                        <p className="font-medium text-blue-900 mb-2">📋 How it works:</p>
                        <ul className="list-disc list-inside space-y-1 text-blue-800">
                            <li>Steps are processed in the order shown above</li>
                            <li>Each step requires approval from a user with the specified role</li>
                            <li>Once the final step approves, the loan becomes active</li>
                            <li>Any step can reject the loan, ending the workflow</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div >
    );
}
