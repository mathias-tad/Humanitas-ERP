import { useState, useRef, useEffect } from "react";
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
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL, getAvatarUrl as generateAvatarUrl, getUploadUrl } from "@/config/api.config";
import { Camera, Loader2, Trash2, FileText, Download, File } from "lucide-react";

interface AccountSettingsProps {
  disabled?: boolean;
}

export function AccountSettings({ disabled = false }: AccountSettingsProps) {
  const { user, updateUser, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAuthHeaders = (includeContentType = false) => {
    const headers: Record<string, string> = {};
    if (includeContentType) headers['Content-Type'] = 'application/json';
    return headers;
  };

  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    phone: "",
    birth_date: "",
    // Address fields
    address: "",
    city: "",
    state: "",
    country: "",
    postal_code: "",
    // Personal info
    gender: "",
    marital_status: "",
    nationality: "",
    national_id: "",
    // Emergency contact
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relationship: "",
    // Employment
    hire_date: "",
    employment_type: "",
  });
  const [passwords, setPasswords] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [attachments, setAttachments] = useState<any[]>([]);

  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: "", text: "" });
  const [passwordMessage, setPasswordMessage] = useState({ type: "", text: "" });

  // Refresh user data on mount to get latest profile fields
  useEffect(() => {
    refreshUser();
  }, []);

  useEffect(() => {
    if (user) {
      setProfile({
        full_name: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
        birth_date: user.birth_date || "",
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
        hire_date: user.hire_date || "",
        employment_type: user.employment_type || "",
      });
      fetchAttachments();
    }
  }, [user]);

  const fetchAttachments = async () => {
    setIsLoadingAttachments(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users/me/attachments`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setAttachments(data);
      }
    } catch (error) {
      console.error("Failed to fetch attachments:", error);
    } finally {
      setIsLoadingAttachments(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsLoadingProfile(true);
    setProfileMessage({ type: "", text: "" });

    try {
      const response = await fetch(`${API_BASE_URL}/users/me`, {
        method: "PATCH",
        headers: getAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify(profile),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update profile");
      }

      const data = await response.json();
      console.log('Profile update response:', data);
      // Handle both array and object responses
      const updatedUser = Array.isArray(data) ? data[0] : data;
      updateUser(updatedUser);
      // Also update local state
      setProfile({
        full_name: updatedUser.full_name || "",
        email: updatedUser.email || "",
        phone: updatedUser.phone || "",
        birth_date: updatedUser.birth_date || "",
        address: updatedUser.address || "",
        city: updatedUser.city || "",
        state: updatedUser.state || "",
        country: updatedUser.country || "",
        postal_code: updatedUser.postal_code || "",
        gender: updatedUser.gender || "",
        marital_status: updatedUser.marital_status || "",
        nationality: updatedUser.nationality || "",
        national_id: updatedUser.national_id || "",
        emergency_contact_name: updatedUser.emergency_contact_name || "",
        emergency_contact_phone: updatedUser.emergency_contact_phone || "",
        emergency_contact_relationship: updatedUser.emergency_contact_relationship || "",
        hire_date: updatedUser.hire_date || "",
        employment_type: updatedUser.employment_type || "",
      });
      setProfileMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (error) {
      setProfileMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to update profile",
      });
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwords.new_password !== passwords.confirm_password) {
      setPasswordMessage({ type: "error", text: "Passwords do not match" });
      return;
    }

    if (passwords.new_password.length < 8) {
      setPasswordMessage({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }

    setIsLoadingPassword(true);
    setPasswordMessage({ type: "", text: "" });

    try {
      const response = await fetch(`${API_BASE_URL}/users/me/password`, {
        method: "POST",
        headers: getAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({
          current_password: passwords.current_password,
          new_password: passwords.new_password,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to change password");
      }

      setPasswords({ current_password: "", new_password: "", confirm_password: "" });
      setPasswordMessage({ type: "success", text: "Password changed successfully!" });
    } catch (error) {
      setPasswordMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to change password",
      });
    } finally {
      setIsLoadingPassword(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setProfileMessage({ type: "error", text: "Please select an image file" });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setProfileMessage({ type: "error", text: "Image must be less than 5MB" });
      return;
    }

    setIsUploadingAvatar(true);
    setProfileMessage({ type: "", text: "" });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE_URL}/users/me/avatar`, {
        method: "POST",
        headers: getAuthHeaders(), // Don't include Content-Type for FormData
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload avatar");
      }

      const data = await response.json();
      console.log('Avatar upload response:', data);
      // Handle both array and object responses
      const updatedUser = Array.isArray(data) ? data[0] : data;
      // Add cache buster to avatar URL
      if (updatedUser.avatar_url) {
        updatedUser.avatar_url = `${updatedUser.avatar_url}?t=${Date.now()}`;
      }
      updateUser(updatedUser);
      setProfileMessage({ type: "success", text: "Avatar uploaded successfully!" });
    } catch (error) {
      setProfileMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to upload avatar",
      });
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteAvatar = async () => {
    if (!user?.avatar_url) return;

    setIsUploadingAvatar(true);
    setProfileMessage({ type: "", text: "" });

    try {
      const response = await fetch(`${API_BASE_URL}/users/me/avatar`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete avatar");
      }

      const data = await response.json();
      // Handle both array and object responses
      const updatedUser = Array.isArray(data) ? data[0] : data;
      updateUser(updatedUser);
      setProfileMessage({ type: "success", text: "Avatar removed successfully!" });
    } catch (error) {
      setProfileMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to delete avatar",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const getAvatarUrl = () => {
    if (user?.avatar_url) {
      let avatarUrl = getUploadUrl(user.avatar_url);
      // Add cache buster if not already present
      if (!avatarUrl.includes('?t=')) {
        avatarUrl = `${avatarUrl}?t=${Date.now()}`;
      }
      return avatarUrl;
    }
    return generateAvatarUrl(user?.full_name || "User");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Profile Picture Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>
            Upload a profile picture to personalize your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative">
              <div
                className="h-24 w-24 rounded-full overflow-hidden bg-gray-200 cursor-pointer group"
                onClick={handleAvatarClick}
              >
                {isUploadingAvatar ? (
                  <div className="h-full w-full flex items-center justify-center bg-gray-100">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : user?.avatar_url ? (
                  <img
                    src={getAvatarUrl()}
                    alt={user.full_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-primary text-primary-foreground text-2xl font-bold">
                    {getInitials(user?.full_name || "User")}
                  </div>
                )}
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <Camera className="h-6 w-6 text-white" />
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={handleAvatarClick}
                disabled={isUploadingAvatar}
              >
                {isUploadingAvatar ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload New Picture"
                )}
              </Button>
              {user?.avatar_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteAvatar}
                  disabled={isUploadingAvatar}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Picture
                </Button>
              )}
              <p className="text-xs text-gray-500">
                JPG, PNG or GIF. Max size 5MB.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            {disabled
              ? "You can view your profile information. Contact an administrator to make changes."
              : "Update your personal information."
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profileMessage.text && (
            <div
              className={`px-4 py-2 rounded text-sm ${profileMessage.type === "success"
                  ? "bg-green-50 text-green-600"
                  : "bg-red-50 text-red-600"
                }`}
            >
              {profileMessage.text}
            </div>
          )}
          {/* Basic Information */}
          <h4 className="font-medium text-sm text-gray-700 border-b pb-2">Basic Information</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                type="text"
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                disabled={disabled}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+1-555-0100"
                disabled={disabled}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="birth_date">Date of Birth</Label>
              <Input
                id="birth_date"
                type="date"
                value={profile.birth_date ? profile.birth_date.split('T')[0] : ""}
                onChange={(e) => setProfile({ ...profile, birth_date: e.target.value })}
                disabled={disabled}
              />
            </div>
          </div>

          {/* Address Information */}
          <h4 className="font-medium text-sm text-gray-700 border-b pb-2 mt-4">Address</h4>
          <div className="grid gap-2">
            <Label htmlFor="address">Street Address</Label>
            <Input
              id="address"
              value={profile.address}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              placeholder="123 Main Street"
              disabled={disabled}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={profile.city}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="state">State / Province</Label>
              <Input
                id="state"
                value={profile.state}
                onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                disabled={disabled}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={profile.country}
                onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="postal_code">Postal Code</Label>
              <Input
                id="postal_code"
                value={profile.postal_code}
                onChange={(e) => setProfile({ ...profile, postal_code: e.target.value })}
                disabled={disabled}
              />
            </div>
          </div>

          {/* Personal Information */}
          <h4 className="font-medium text-sm text-gray-700 border-b pb-2 mt-4">Personal Information</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                value={profile.gender}
                onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                disabled={disabled}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
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
                value={profile.marital_status}
                onChange={(e) => setProfile({ ...profile, marital_status: e.target.value })}
                disabled={disabled}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
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
                value={profile.nationality}
                onChange={(e) => setProfile({ ...profile, nationality: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="national_id">National ID / SSN</Label>
              <Input
                id="national_id"
                value={profile.national_id}
                onChange={(e) => setProfile({ ...profile, national_id: e.target.value })}
                disabled={disabled}
              />
            </div>
          </div>

          {/* Emergency Contact */}
          <h4 className="font-medium text-sm text-gray-700 border-b pb-2 mt-4">Emergency Contact</h4>
          <div className="grid gap-2">
            <Label htmlFor="emergency_contact_name">Contact Name</Label>
            <Input
              id="emergency_contact_name"
              value={profile.emergency_contact_name}
              onChange={(e) => setProfile({ ...profile, emergency_contact_name: e.target.value })}
              disabled={disabled}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="emergency_contact_phone">Contact Phone</Label>
              <Input
                id="emergency_contact_phone"
                value={profile.emergency_contact_phone}
                onChange={(e) => setProfile({ ...profile, emergency_contact_phone: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emergency_contact_relationship">Relationship</Label>
              <select
                id="emergency_contact_relationship"
                value={profile.emergency_contact_relationship}
                onChange={(e) => setProfile({ ...profile, emergency_contact_relationship: e.target.value })}
                disabled={disabled}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
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

          {/* Employment Information (Read-only) */}
          <h4 className="font-medium text-sm text-gray-700 border-b pb-2 mt-4">Employment Information</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Role</Label>
              <Input type="text" value={user?.role || ""} disabled className="bg-gray-50" />
            </div>
            <div className="grid gap-2">
              <Label>Employment Type</Label>
              <Input
                type="text"
                value={profile.employment_type ? profile.employment_type.replace('_', '-') : ""}
                disabled
                className="bg-gray-50 capitalize"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Department</Label>
              <Input type="text" value={user?.department || ""} disabled className="bg-gray-50" />
            </div>
            <div className="grid gap-2">
              <Label>Position</Label>
              <Input type="text" value={user?.position || ""} disabled className="bg-gray-50" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Hire Date</Label>
            <Input
              type="text"
              value={profile.hire_date ? new Date(profile.hire_date).toLocaleDateString() : ""}
              disabled
              className="bg-gray-50"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveProfile} disabled={isLoadingProfile || disabled}>
            {isLoadingProfile ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Profile"
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Security Card */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>
            Update your password to keep your account secure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {passwordMessage.text && (
            <div
              className={`px-4 py-2 rounded text-sm ${passwordMessage.type === "success"
                  ? "bg-green-50 text-green-600"
                  : "bg-red-50 text-red-600"
                }`}
            >
              {passwordMessage.text}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              placeholder="Enter current password"
              value={passwords.current_password}
              onChange={(e) =>
                setPasswords({ ...passwords, current_password: e.target.value })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              placeholder="Enter new password (min 8 characters)"
              value={passwords.new_password}
              onChange={(e) =>
                setPasswords({ ...passwords, new_password: e.target.value })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm new password"
              value={passwords.confirm_password}
              onChange={(e) =>
                setPasswords({ ...passwords, confirm_password: e.target.value })
              }
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleChangePassword} disabled={isLoadingPassword}>
            {isLoadingPassword ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Password"
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Attachments Card */}
      <Card>
        <CardHeader>
          <CardTitle>My Documents</CardTitle>
          <CardDescription>
            View your uploaded documents (CV, certificates, contracts, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAttachments ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : attachments.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No documents uploaded yet. Contact HR to upload your documents.
            </p>
          ) : (
            <div className="space-y-3">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded">
                      {attachment.file_type?.includes('pdf') ? (
                        <FileText className="h-5 w-5 text-blue-600" />
                      ) : (
                        <File className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{attachment.original_name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="capitalize">{attachment.category?.replace('_', ' ')}</span>
                        <span>•</span>
                        <span>{(attachment.file_size / 1024).toFixed(1)} KB</span>
                        <span>•</span>
                        <span>{new Date(attachment.created_at).toLocaleDateString()}</span>
                      </div>
                      {attachment.description && (
                        <p className="text-xs text-gray-400 mt-1">{attachment.description}</p>
                      )}
                    </div>
                  </div>
                  <a
                    href={`${API_BASE_URL.replace('/api/v1', '')}${attachment.file_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Download"
                  >
                    <Download className="h-4 w-4 text-gray-600" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
