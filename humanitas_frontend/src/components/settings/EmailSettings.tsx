import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Mail, CheckCircle, AlertCircle } from "lucide-react";
import { API_BASE_URL } from "@/config/api.config";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface EmailConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  smtp_secure: boolean;
  from_name: string;
  from_email: string;
}

interface EmailSettingsProps {
  disabled?: boolean;
}

export function EmailSettings({ disabled: _disabled = false }: EmailSettingsProps) {
  const [config, setConfig] = useState<EmailConfig>({
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_pass: "",
    smtp_secure: true,
    from_name: "",
    from_email: "",
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/settings/email`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.smtp_pass) data.smtp_pass = "";
        setConfig(data);
      }
    } catch (error) {
      console.error("Failed to fetch email settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);
      
      const payload: any = { ...config };
      if (!payload.smtp_pass || payload.smtp_pass.trim() === "") {
        delete payload.smtp_pass;
      }

      const response = await fetch(`${API_BASE_URL}/settings/email`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save settings");
      }

      setSuccess("Email settings saved successfully");
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);
      
      const response = await fetch(`${API_BASE_URL}/settings/email/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ email: "test@example.com" }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setTestResult({ success: true, message: "Test email sent successfully!" });
      } else {
        setTestResult({ success: false, message: data.message || "Failed to send test email" });
      }
    } catch (error: any) {
      setTestResult({ success: false, message: error.message || "Connection error" });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>SMTP Configuration</CardTitle>
          <CardDescription>
            Configure your email server settings for sending notifications, welcome emails, and alerts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="bg-green-50 text-green-900 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp_host">SMTP Host</Label>
              <Input
                id="smtp_host"
                placeholder="smtp.example.com"
                value={config.smtp_host}
                onChange={(e) => setConfig({ ...config, smtp_host: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp_port">SMTP Port</Label>
              <Input
                id="smtp_port"
                type="number"
                placeholder="587"
                value={config.smtp_port}
                onChange={(e) => setConfig({ ...config, smtp_port: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp_user">SMTP Username</Label>
              <Input
                id="smtp_user"
                placeholder="user@example.com"
                value={config.smtp_user}
                onChange={(e) => setConfig({ ...config, smtp_user: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp_pass">SMTP Password</Label>
              <Input
                id="smtp_pass"
                type="password"
                placeholder="••••••••"
                value={config.smtp_pass}
                onChange={(e) => setConfig({ ...config, smtp_pass: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Switch
              id="smtp_secure"
              checked={config.smtp_secure}
              onCheckedChange={(checked: boolean) => setConfig({ ...config, smtp_secure: checked })}
            />
            <Label htmlFor="smtp_secure">Use Secure Connection (TLS/SSL)</Label>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <Label htmlFor="from_name">Sender Name</Label>
              <Input
                id="from_name"
                placeholder="Your Company Name"
                value={config.from_name}
                onChange={(e) => setConfig({ ...config, from_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="from_email">Sender Email</Label>
              <Input
                id="from_email"
                placeholder="noreply@yourcompany.com"
                value={config.from_email}
                onChange={(e) => setConfig({ ...config, from_email: e.target.value })}
              />
            </div>
          </div>

          {testResult && (
            <Alert className={testResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
              {testResult.success ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
              <AlertTitle>{testResult.success ? "Success" : "Failed"}</AlertTitle>
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={handleTestEmail} 
            disabled={isTesting || isSaving || !config.smtp_host}
          >
            {isTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Test...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Test Email
              </>
            )}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Configuration
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
