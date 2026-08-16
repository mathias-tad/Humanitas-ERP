import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE_URL } from "@/config/api.config";
import { Loader2, Plus, Pencil, Trash2, X } from "lucide-react";

interface CompanySettingsData {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  tax_id: string;
}

interface Department {
  id: string;
  name: string;
  description: string;
}

interface CompanySettingsProps {
  disabled?: boolean;
}

export function CompanySettings({ disabled = false }: CompanySettingsProps) {
  const [settings, setSettings] = useState<CompanySettingsData>({
    company_name: "",
    company_address: "",
    company_phone: "",
    company_email: "",
    tax_id: "",
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  
  // Department modal state
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptForm, setDeptForm] = useState({ name: "", description: "" });
  const [isSavingDept, setIsSavingDept] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchDepartments();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings/company`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (data && Object.keys(data).length > 0) {
          setSettings({ ...settings, ...data });
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings/departments`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setDepartments(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch(`${API_BASE_URL}/settings/company`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      setMessage({ type: "success", text: "Company info saved successfully!" });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save company info" });
    } finally {
      setIsSaving(false);
    }
  };

  const openAddDeptModal = () => {
    setEditingDept(null);
    setDeptForm({ name: "", description: "" });
    setShowDeptModal(true);
  };

  const openEditDeptModal = (dept: Department) => {
    setEditingDept(dept);
    setDeptForm({ name: dept.name, description: dept.description || "" });
    setShowDeptModal(true);
  };

  const handleSaveDept = async () => {
    if (!deptForm.name.trim()) return;
    
    setIsSavingDept(true);
    try {
      const url = editingDept
        ? `${API_BASE_URL}/settings/departments/${editingDept.id}`
        : `${API_BASE_URL}/settings/departments`;
      
      const response = await fetch(url, {
        method: editingDept ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(deptForm),
      });

      if (!response.ok) {
        throw new Error("Failed to save department");
      }

      await fetchDepartments();
      setShowDeptModal(false);
    } catch (error) {
      console.error("Failed to save department:", error);
    } finally {
      setIsSavingDept(false);
    }
  };

  const handleDeleteDept = async (id: string) => {
    if (!confirm("Are you sure you want to delete this department?")) return;
    
    try {
      await fetch(`${API_BASE_URL}/settings/departments/${id}`, {
        method: "DELETE",
        credentials: 'include',
      });
      await fetchDepartments();
    } catch (error) {
      console.error("Failed to delete department:", error);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>
            Manage your company details and contact information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message.text && (
            <div
              className={`px-4 py-2 rounded text-sm ${
                message.type === "success"
                  ? "bg-green-50 text-green-600"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {message.text}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={settings.company_name}
              onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
              disabled={disabled}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="companyAddress">Company Address</Label>
            <Input
              id="companyAddress"
              value={settings.company_address}
              onChange={(e) => setSettings({ ...settings, company_address: e.target.value })}
              disabled={disabled}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="companyPhone">Company Phone</Label>
            <Input
              id="companyPhone"
              type="tel"
              value={settings.company_phone}
              onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
              disabled={disabled}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="companyEmail">Company Email</Label>
            <Input
              id="companyEmail"
              type="email"
              value={settings.company_email}
              onChange={(e) => setSettings({ ...settings, company_email: e.target.value })}
              disabled={disabled}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="taxId">Tax ID / Registration Number</Label>
            <Input
              id="taxId"
              value={settings.tax_id}
              onChange={(e) => setSettings({ ...settings, tax_id: e.target.value })}
              disabled={disabled}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isSaving || disabled}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Company Info"
            )}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Departments</CardTitle>
          <CardDescription>
            Manage your company departments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {departments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No departments yet. Add your first department.
              </p>
            ) : (
              departments.map((dept) => (
                <div key={dept.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <span className="font-medium">{dept.name}</span>
                    {dept.description && (
                      <p className="text-sm text-gray-500">{dept.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEditDeptModal(dept)} disabled={disabled}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteDept(dept.id)} disabled={disabled}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            <Button variant="outline" className="w-full" onClick={openAddDeptModal} disabled={disabled}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Department
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Department Modal */}
      {showDeptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingDept ? "Edit Department" : "Add Department"}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setShowDeptModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="deptName">Name</Label>
                <Input
                  id="deptName"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  placeholder="e.g., Human Resources"
                />
              </div>
              <div>
                <Label htmlFor="deptDesc">Description (optional)</Label>
                <Input
                  id="deptDesc"
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  placeholder="Department description"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDeptModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveDept} disabled={isSavingDept || !deptForm.name.trim()}>
                  {isSavingDept ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
