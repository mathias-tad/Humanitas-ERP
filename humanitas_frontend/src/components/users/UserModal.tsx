import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  User,
  MapPin,
  UserCircle,
  Phone,
  Briefcase,
  Fingerprint,
  Smile,
  Hand,
  CreditCard,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { API_BASE_URL } from "@/config/api.config";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface Role {
  id: string;
  name: string;
}

interface UserData {
  id?: string;
  full_name: string;
  email: string;
  phone: string;
  role_id: string;
  department: string;
  position: string;
  company_id?: string;
  branch_id?: string;
  password?: string;
  is_active?: boolean;
  // New fields
  birth_date?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  gender?: string;
  marital_status?: string;
  nationality?: string;
  national_id?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  hire_date?: string;
  employment_type?: string;
  basic_salary?: number;
  tin?: string;
  account_number?: string;
  employee_category_id?: string;
  desert_allowance_percent?: number;
  hardship_allowance_percent?: number;
  allowance_settings?: {
    income_type_id: string;
    tier: string;
    custom_amount?: number;
  }[];
}

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: UserData) => Promise<void>;
  user?: UserData | null;
  roles: Role[];
}

type TabType = "basic" | "address" | "personal" | "emergency" | "employment" | "biometrics";

export function UserModal({ isOpen, onClose, onSave, user, roles }: UserModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("basic");
  const [formData, setFormData] = useState<UserData>({
    full_name: "",
    email: "",
    phone: "",
    role_id: "",
    department: "",
    position: "",
    company_id: "",
    branch_id: "",
    password: "",
    birth_date: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postal_code: "",
    gender: "",
    marital_status: "",
    nationality: "",
    national_id: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relationship: "",
    hire_date: "",
    employment_type: "",
    basic_salary: 0,
    tin: "",
    account_number: "",
    employee_category_id: "",
    desert_allowance_percent: 0,
    hardship_allowance_percent: 0,
    allowance_settings: [],
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [isNewDeptDialogOpen, setIsNewDeptDialogOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");
  const [isCreatingDept, setIsCreatingDept] = useState(false);
  const { hasPermission } = useAuth();
  const canManageDepartments = hasPermission('manage_departments') || hasPermission('edit_company_settings') || hasPermission('create_users');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [biometricStatus, setBiometricStatus] = useState<any>(null);
  const [isLoadingBiometrics, setIsLoadingBiometrics] = useState(false);
  const isEditMode = !!user?.id;

  const fetchBiometricStatus = async (userId: string) => {
    setIsLoadingBiometrics(true);
    try {
      const res = await fetch(`${API_BASE_URL}/biometric-devices/users/${userId}/biometric-status`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setBiometricStatus(data);
      }
    } catch (e) {
      console.error("Failed to fetch biometric status:", e);
    } finally {
      setIsLoadingBiometrics(false);
    }
  };

  useEffect(() => {
    if (user) {
      if (user.id) {
        fetchBiometricStatus(user.id);
      } else {
        setBiometricStatus(null);
      }
      setFormData({
        full_name: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
        role_id: user.role_id || "",
        department: user.department || "",
        position: user.position || "",
        company_id: (user as any).company_id || "",
        branch_id: (user as any).branch_id || "",
        password: "",
        birth_date: user.birth_date ? user.birth_date.split('T')[0] : "",
        address: user.address || "",
        city: user.city || "",
        state: user.state || "",
        country: user.country || "",
        postal_code: user.postal_code || "",
        gender: user.gender || "",
        marital_status: user.marital_status || "",
        nationality: user.nationality || "",
        national_id: user.national_id || "",
        emergency_contact_name: user.emergency_contact_name || "",
        emergency_contact_phone: user.emergency_contact_phone || "",
        emergency_contact_relationship: user.emergency_contact_relationship || "",
        hire_date: user.hire_date ? user.hire_date.split('T')[0] : "",
        employment_type: user.employment_type || "",
        basic_salary: user.basic_salary || 0,
        tin: user.tin || "",
        account_number: user.account_number || "",
        employee_category_id: (user as any).employee_category_id || "",
        desert_allowance_percent: (user as any).desert_allowance_percent || 0,
        hardship_allowance_percent: (user as any).hardship_allowance_percent || 0,
        allowance_settings: (user as any).allowance_settings || [],
      });
    } else {
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        role_id: "",
        department: "",
        position: "",
        company_id: "",
        branch_id: "",
        password: "",
        birth_date: "",
        address: "",
        city: "",
        state: "",
        country: "",
        postal_code: "",
        gender: "",
        marital_status: "",
        nationality: "",
        national_id: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
        emergency_contact_relationship: "",
        hire_date: "",
        employment_type: "",
        basic_salary: 0,
        tin: "",
        account_number: "",
        employee_category_id: "",
        desert_allowance_percent: 0,
        hardship_allowance_percent: 0,
        allowance_settings: [],
      });
    }
    setError("");
    setActiveTab("basic");
    fetchCategories();
    fetchDepartments();
    fetchCompanies();
  }, [user, isOpen]);

  const fetchCompanies = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings/companies`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setCompanies(Array.isArray(data) ? data : data.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch companies:", e);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const url = formData.company_id
      ? `${API_BASE_URL}/settings/branches?company_id=${formData.company_id}`
      : `${API_BASE_URL}/settings/branches`;
    fetch(url, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => setBranches(Array.isArray(data) ? data : data.data || []))
      .catch(() => {});
  }, [formData.company_id, isOpen]);

  const fetchDepartments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings/departments`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setDepartments(Array.isArray(data) ? data : data.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch departments:", e);
    }
  };

  const handleCreateDepartment = async () => {
    if (!newDeptName.trim()) {
      toast.error("Please enter a department name");
      return;
    }
    setIsCreatingDept(true);
    try {
      const res = await fetch(`${API_BASE_URL}/settings/departments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newDeptName.trim(), description: newDeptDesc.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create department");
      }
      const created = await res.json();
      toast.success(`Department "${created.name || newDeptName.trim()}" created!`);
      await fetchDepartments();
      setFormData((prev) => ({ ...prev, department: created.name || newDeptName.trim() }));
      setNewDeptName("");
      setNewDeptDesc("");
      setIsNewDeptDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to create department");
    } finally {
      setIsCreatingDept(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/employee-categories`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (e) { console.error(e); }
  };



  const handleSubmit = async () => {
    if (!formData.full_name.trim() || !formData.email.trim()) {
      setError("Name and email are required");
      setActiveTab("basic");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const dataToSave: any = {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone || null,
        role_id: formData.role_id || null,
        department: formData.department || null,
        position: formData.position || null,
        company_id: formData.company_id || null,
        branch_id: formData.branch_id || null,
        // New fields
        birth_date: formData.birth_date || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        country: formData.country || null,
        postal_code: formData.postal_code || null,
        gender: formData.gender || null,
        marital_status: formData.marital_status || null,
        nationality: formData.nationality || null,
        national_id: formData.national_id || null,
        emergency_contact_name: formData.emergency_contact_name || null,
        emergency_contact_phone: formData.emergency_contact_phone || null,
        emergency_contact_relationship: formData.emergency_contact_relationship || null,
        hire_date: formData.hire_date || null,
        employment_type: formData.employment_type || null,
        basic_salary: formData.basic_salary || 0,
        tin: formData.tin || null,
        account_number: formData.account_number || null,
        employee_category_id: formData.employee_category_id || null,
        desert_allowance_percent: formData.desert_allowance_percent || 0,
        hardship_allowance_percent: formData.hardship_allowance_percent || 0,
        allowance_settings: formData.allowance_settings || [],
      };

      if (formData.password && formData.password.trim().length > 0) {
        dataToSave.password = formData.password;
      }

      await onSave(dataToSave);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save user");
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: "basic" as TabType, label: "Basic Info", icon: User },
    { id: "address" as TabType, label: "Address", icon: MapPin },
    { id: "personal" as TabType, label: "Personal", icon: UserCircle },
    { id: "emergency" as TabType, label: "Emergency", icon: Phone },
    { id: "employment" as TabType, label: "Employment", icon: Briefcase },
    ...(isEditMode ? [{ id: "biometrics" as TabType, label: "Biometrics", icon: Fingerprint }] : []),
  ];





  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit User" : "Add New User"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Update user information" : "Create a new user account"}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-2 rounded text-sm">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto py-4">
          {/* Basic Info Tab */}
          {activeTab === "basic" && (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@company.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 234-567-8901"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="birth_date">Date of Birth</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={formData.birth_date || ""}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">
                  {isEditMode ? "New Password (leave blank to keep current)" : "Password (optional)"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password || ""}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={isEditMode ? "Leave blank to keep current" : "Leave blank to send setup email"}
                />
                {!isEditMode && (
                  <p className="text-xs text-muted-foreground">
                    If left blank, user will receive an email to set up their password
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Address Tab */}
          {activeTab === "address" && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  value={formData.address || ""}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Main Street"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city || ""}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="New York"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="state">State / Province</Label>
                  <Input
                    id="state"
                    value={formData.state || ""}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="NY"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country || ""}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="United States"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code || ""}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    placeholder="10001"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Personal Tab */}
          {activeTab === "personal" && (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="gender">Gender</Label>
                  <select
                    id="gender"
                    value={formData.gender || ""}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="marital_status">Marital Status</Label>
                  <select
                    id="marital_status"
                    value={formData.marital_status || ""}
                    onChange={(e) => setFormData({ ...formData, marital_status: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select...</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="nationality">Nationality</Label>
                  <Input
                    id="nationality"
                    value={formData.nationality || ""}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    placeholder="American"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="national_id">National ID / SSN</Label>
                  <Input
                    id="national_id"
                    value={formData.national_id || ""}
                    onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                    placeholder="XXX-XX-XXXX"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Emergency Contact Tab */}
          {activeTab === "emergency" && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="emergency_contact_name">Contact Name</Label>
                <Input
                  id="emergency_contact_name"
                  value={formData.emergency_contact_name || ""}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                  placeholder="Jane Doe"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="emergency_contact_phone">Contact Phone</Label>
                  <Input
                    id="emergency_contact_phone"
                    value={formData.emergency_contact_phone || ""}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                    placeholder="+1 234-567-8901"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="emergency_contact_relationship">Relationship</Label>
                  <select
                    id="emergency_contact_relationship"
                    value={formData.emergency_contact_relationship || ""}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_relationship: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select...</option>
                    <option value="spouse">Spouse</option>
                    <option value="parent">Parent</option>
                    <option value="sibling">Sibling</option>
                    <option value="child">Child</option>
                    <option value="friend">Friend</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Employment Tab */}
          {activeTab === "employment" && (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    value={formData.role_id}
                    onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select role...</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="employment_type">Employment Type</Label>
                  <select
                    id="employment_type"
                    value={formData.employment_type || ""}
                    onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select...</option>
                    <option value="full_time">Full-time</option>
                    <option value="part_time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="intern">Intern</option>
                    <option value="freelance">Freelance</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="category">Employee Category</Label>
                <select
                  id="category"
                  value={formData.employee_category_id || ""}
                  onChange={(e) => setFormData({ ...formData, employee_category_id: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="company_id">Company</Label>
                  <select
                    id="company_id"
                    value={formData.company_id || ""}
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value, branch_id: "" })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select Company...</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.is_default ? " (Default)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="branch_id">Branch</Label>
                  <select
                    id="branch_id"
                    value={formData.branch_id || ""}
                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select Branch...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}{b.is_default ? " (Default)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="department">Department</Label>
                    {canManageDepartments && (
                      <button
                        type="button"
                        onClick={() => setIsNewDeptDialogOpen(true)}
                        className="text-xs text-primary hover:underline font-medium cursor-pointer"
                      >
                        + New Department
                      </button>
                    )}
                  </div>
                  <select
                    id="department"
                    value={formData.department}
                    onChange={(e) => {
                      if (e.target.value === "__add_new__") {
                        setIsNewDeptDialogOpen(true);
                      } else {
                        setFormData({ ...formData, department: e.target.value });
                      }
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select Department...</option>
                    {formData.department && !departments.some((d) => d.name?.toLowerCase() === formData.department?.toLowerCase()) && (
                      <option value={formData.department}>{formData.department} (Current)</option>
                    )}
                    {departments.map((dept) => (
                      <option key={dept.id || dept.name} value={dept.name}>
                        {dept.name}
                      </option>
                    ))}
                    {canManageDepartments && (
                      <option value="__add_new__" className="text-primary font-medium">
                        + Add New Department...
                      </option>
                    )}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="Software Engineer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="hire_date">Hire Date</Label>
                  <Input
                    id="hire_date"
                    type="date"
                    value={formData.hire_date || ""}
                    onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="basic_salary">Basic Salary</Label>
                  <Input
                    id="basic_salary"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.basic_salary || ""}
                    onChange={(e) => setFormData({ ...formData, basic_salary: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="tin">TIN Number</Label>
                  <Input
                    id="tin"
                    value={formData.tin || ""}
                    onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                    placeholder="Tax Identification Number"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="account_number">Bank Account Number</Label>
                  <Input
                    id="account_number"
                    value={formData.account_number || ""}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    placeholder="Bank Account"
                  />
                </div>
              </div>

              {/* Allowance Tiers Selection - Hidden per user request */}
              {/* {formData.employee_category_id && selectedCategory && (
                <div className="space-y-4 border-t pt-4 mt-2">
                  <h4 className="font-medium text-sm">Allowances Configuration</h4>

                  {/* Desert Allowance */}
              {/* <div className="grid gap-3 p-3 bg-gray-50 rounded-md">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-bold uppercase text-gray-500">Desert Allowance</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Custom %:</span>
                        <Input
                          type="number"
                          className="h-7 w-20 text-right"
                          value={formData.desert_allowance_percent}
                          onChange={(e) => setFormData({ ...formData, desert_allowance_percent: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(['min', 'mid', 'max'] as const).map(tier => {
                        const tierVal = parseFloat((selectedCategory as any)[`desert_${tier}_percent`]) || 0;
                        return (
                          <div
                            key={tier}
                            onClick={() => applyTierResult('desert', tier)}
                            className={`
                                flex-1 border rounded px-3 py-2 cursor-pointer transition-colors text-center
                                ${formData.desert_allowance_percent === tierVal && tierVal > 0 ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-gray-100'}
                              `}
                          >
                            <div className="text-xs uppercase font-semibold text-gray-500">{tier}</div>
                            <div className="font-bold">{tierVal}%</div>
                          </div>
                        )
                      })}
                    </div>
                  </div> */}

              {/* Hardship Allowance */}
              {/* <div className="grid gap-3 p-3 bg-gray-50 rounded-md">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-bold uppercase text-gray-500">Hardship Allowance</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Custom %:</span>
                        <Input
                          type="number"
                          className="h-7 w-20 text-right"
                          value={formData.hardship_allowance_percent}
                          onChange={(e) => setFormData({ ...formData, hardship_allowance_percent: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(['min', 'mid', 'max'] as const).map(tier => {
                        const tierVal = parseFloat((selectedCategory as any)[`hardship_${tier}_percent`]) || 0;
                        return (
                          <div
                            key={tier}
                            onClick={() => applyTierResult('hardship', tier)}
                            className={`
                                flex-1 border rounded px-3 py-2 cursor-pointer transition-colors text-center
                                ${formData.hardship_allowance_percent === tierVal && tierVal > 0 ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-gray-100'}
                              `}
                          >
                            <div className="text-xs uppercase font-semibold text-gray-500">{tier}</div>
                            <div className="font-bold">{tierVal}%</div>
                          </div>
                        )
                      })}
                    </div>
                  </div> */}

              {/* Dynamic Allowances */}
              {/* {categoryAllowances && categoryAllowances.length > 0 && categoryAllowances.map(allowance => {
                    const userSetting = formData.allowance_settings?.find(s => s.income_type_id === allowance.income_type_id);
                    const currentTier = userSetting?.tier || 'none';
                    const min = parseFloat(allowance.min_amount) || 0;
                    const mid = parseFloat(allowance.mid_amount) || 0;
                    const max = parseFloat(allowance.max_amount) || 0;

                    // Identify as Tiered or Fixed
                    const isTiered = min > 0 || mid > 0 || max > 0;

                    return (
                      <div key={allowance.income_type_id} className="grid gap-3 p-3 bg-gray-50 rounded-md mt-3">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs font-bold uppercase text-gray-500">{allowance.income_type_name}</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Custom:</span>
                            <Input
                              type="number"
                              className="h-7 w-20 text-right"
                              value={userSetting?.custom_amount || ''}
                              placeholder={allowance.amount}
                              onChange={(e) => {
                                updateAllowanceSetting(allowance.income_type_id, 'custom_amount', parseFloat(e.target.value) || 0);
                                updateAllowanceSetting(allowance.income_type_id, 'tier', 'custom');
                              }}
                            />
                          </div>
                        </div>

                        {isTiered ? (
                          <div className="flex gap-2">
                            <div
                              onClick={() => updateAllowanceSetting(allowance.income_type_id, 'tier', 'none')}
                              className={`flex-1 border rounded px-3 py-2 cursor-pointer transition-colors text-center ${currentTier === 'none' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-gray-100 bg-white'}`}
                            >
                              <div className="text-xs uppercase font-semibold text-gray-500">Default</div>
                              <div className="font-bold text-xs">({allowance.default_tier || 'Fixed'})</div>
                            </div>

                            {min > 0 && (
                              <div
                                onClick={() => updateAllowanceSetting(allowance.income_type_id, 'tier', 'min')}
                                className={`flex-1 border rounded px-3 py-2 cursor-pointer transition-colors text-center ${currentTier === 'min' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-gray-100 bg-white'}`}
                              >
                                <div className="text-xs uppercase font-semibold text-gray-500">Min</div>
                                <div className="font-bold">{min}</div>
                              </div>
                            )}
                            {mid > 0 && (
                              <div
                                onClick={() => updateAllowanceSetting(allowance.income_type_id, 'tier', 'mid')}
                                className={`flex-1 border rounded px-3 py-2 cursor-pointer transition-colors text-center ${currentTier === 'mid' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-gray-100 bg-white'}`}
                              >
                                <div className="text-xs uppercase font-semibold text-gray-500">Mid</div>
                                <div className="font-bold">{mid}</div>
                              </div>
                            )}
                            {max > 0 && (
                              <div
                                onClick={() => updateAllowanceSetting(allowance.income_type_id, 'tier', 'max')}
                                className={`flex-1 border rounded px-3 py-2 cursor-pointer transition-colors text-center ${currentTier === 'max' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-gray-100 bg-white'}`}
                              >
                                <div className="text-xs uppercase font-semibold text-gray-500">Max</div>
                                <div className="font-bold">{max}</div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 italic">Fixed Allowance: {allowance.amount} {allowance.calculation_type === 'percentage' ? '%' : ''}</div>
                        )}
                      </div>
                    );
                  })}

                </div>
              )} */}
            </div>
          )}

          {/* Biometrics Tab */}
          {activeTab === "biometrics" && (
            <div className="space-y-4">
              {isLoadingBiometrics ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-2 text-primary" />
                  <p className="text-sm">Loading biometric enrollment records...</p>
                </div>
              ) : (
                <>
                  {/* Top Bar with PIN and Info */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface-2 border border-border">
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                        Terminal Biometric PIN
                      </p>
                      <p className="text-lg font-mono font-bold text-foreground">
                        {biometricStatus?.biometricPin || "Auto-assigned on Sync"}
                      </p>
                    </div>
                    {user?.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fetchBiometricStatus(user.id!)}
                        className="gap-1.5 text-xs"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                      </Button>
                    )}
                  </div>

                  {/* 4 Modalities Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Fingerprint */}
                    <div className="p-3.5 rounded-lg border bg-surface-1/50 border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-600">
                            <Fingerprint className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-medium">Fingerprint</span>
                        </div>
                        {biometricStatus?.hasFingerprint ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" /> Enrolled
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-surface-2 px-2 py-0.5 rounded border border-border">
                            <XCircle className="h-3 w-3" /> Not Enrolled
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {biometricStatus?.templatesSummary?.fingerprints || 0} registered template(s)
                      </p>
                    </div>

                    {/* Face Recognition */}
                    <div className="p-3.5 rounded-lg border bg-surface-1/50 border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600">
                            <Smile className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-medium">Facial Recognition</span>
                        </div>
                        {biometricStatus?.hasFace ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" /> Enrolled
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-surface-2 px-2 py-0.5 rounded border border-border">
                            <XCircle className="h-3 w-3" /> Not Enrolled
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {biometricStatus?.templatesSummary?.faces || 0} facial template(s)
                      </p>
                    </div>

                    {/* Palm Recognition */}
                    <div className="p-3.5 rounded-lg border bg-surface-1/50 border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600">
                            <Hand className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-medium">Palm Print</span>
                        </div>
                        {biometricStatus?.hasPalm ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" /> Enrolled
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-surface-2 px-2 py-0.5 rounded border border-border">
                            <XCircle className="h-3 w-3" /> Not Enrolled
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {biometricStatus?.templatesSummary?.palms || 0} palm template(s)
                      </p>
                    </div>

                    {/* RFID / NFC Card */}
                    <div className="p-3.5 rounded-lg border bg-surface-1/50 border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-teal-500/10 text-teal-600">
                            <CreditCard className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-medium">RFID Card</span>
                        </div>
                        {biometricStatus?.hasCard ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" /> Assigned
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-surface-2 px-2 py-0.5 rounded border border-border">
                            <XCircle className="h-3 w-3" /> None
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        {biometricStatus?.cardNumber || "No card bound"}
                      </p>
                    </div>
                  </div>

                  {/* Terminal Synchronization Status */}
                  <div className="space-y-2 pt-1">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Hardware Terminal Sync & Deployment
                    </Label>
                    {biometricStatus?.deviceRegistrations && biometricStatus.deviceRegistrations.length > 0 ? (
                      <div className="border rounded-md overflow-hidden text-xs">
                        <table className="w-full">
                          <thead className="bg-surface-2 border-b">
                            <tr>
                              <th className="text-left p-2 font-medium">Terminal</th>
                              <th className="text-left p-2 font-medium">Serial No</th>
                              <th className="text-left p-2 font-medium">Sync State</th>
                            </tr>
                          </thead>
                          <tbody>
                            {biometricStatus.deviceRegistrations.map((dev: any) => (
                              <tr key={dev.id} className="border-b last:border-none">
                                <td className="p-2 font-medium">{dev.device_name}</td>
                                <td className="p-2 font-mono text-muted-foreground">{dev.serial_number}</td>
                                <td className="p-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    dev.sync_status === 'synced'
                                      ? 'bg-emerald-500/10 text-emerald-600'
                                      : 'bg-amber-500/10 text-amber-600'
                                  }`}>
                                    {dev.sync_status || 'pending'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-3 rounded border text-xs text-muted-foreground text-center bg-surface-2/40">
                        Employee not synced to any physical terminal yet. Go to <span className="font-semibold text-foreground">Devices</span> and click <span className="font-semibold text-foreground">Sync Employees to Terminal</span>.
                      </div>
                    )}
                  </div>

                  {/* Educational Information Note */}
                  <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-300">
                    <p className="font-semibold mb-0.5">Physical Terminal Enrollment Workflow:</p>
                    <p>
                      Employees are created and managed on the system first. Push this employee to your hardware device via the <strong>Sync Employees</strong> button on the Devices page. Once synced, have the employee place their finger, face, or palm on the device to register their biometric template. The device will automatically push the template back here.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : isEditMode ? (
              "Save Changes"
            ) : (
              "Create User"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Inline Create Department Modal */}
    <Dialog open={isNewDeptDialogOpen} onOpenChange={setIsNewDeptDialogOpen}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Create Department</DialogTitle>
          <DialogDescription>
            Add a new department configuration for employee organization and roster scoping.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="new_dept_name">
              Department Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="new_dept_name"
              placeholder="e.g. Finance, Legal, Operations"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new_dept_desc">Description (Optional)</Label>
            <Input
              id="new_dept_desc"
              placeholder="Brief department responsibilities"
              value={newDeptDesc}
              onChange={(e) => setNewDeptDesc(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => setIsNewDeptDialogOpen(false)}
            disabled={isCreatingDept}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCreateDepartment}
            disabled={isCreatingDept || !newDeptName.trim()}
          >
            {isCreatingDept && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create & Select
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
