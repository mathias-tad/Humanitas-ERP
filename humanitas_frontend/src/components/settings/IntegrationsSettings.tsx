import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { API_BASE_URL } from "@/config/api.config";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface IntegrationsConfig {
  krinai_api_key: string;
}

interface IntegrationsSettingsProps {
  disabled?: boolean;
}

export function IntegrationsSettings({ disabled = false }: IntegrationsSettingsProps) {
  const [config, setConfig] = useState<IntegrationsConfig>({
    krinai_api_key: "",
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/settings/integrations`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error("Failed to fetch integrations settings:", error);
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

      const response = await fetch(`${API_BASE_URL}/settings/integrations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save settings");
      }

      setSuccess("Integration settings saved successfully.");
      
      // Attempt to register webhook automatically if API key exists
      if (payload.krinai_api_key) {
        await handleRegisterWebhook();
      }

    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegisterWebhook = async () => {
    try {
      setIsRegisteringWebhook(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/recruitment/register-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to register webhook with Krinai");
      } else {
        setSuccess(prev => prev ? prev + " Webhook registered with Krinai successfully." : "Webhook registered with Krinai successfully.");
      }
    } catch (err: any) {
      console.error("Webhook registration failed:", err);
      setError(`Webhook Error: ${err.message}`);
    } finally {
      setIsRegisteringWebhook(false);
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
          <CardTitle>Krinai AI Screening Integration</CardTitle>
          <CardDescription>
            Configure your connection to the Krinai AI Screening platform. This will enable seamless syncing of jobs and applicant scores into Humanitas.
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

          <div className="space-y-2">
            <Label htmlFor="krinai_api_key">Krinai API Key</Label>
            <Input
              id="krinai_api_key"
              type="password"
              placeholder="krnai_live_..."
              value={config.krinai_api_key || ""}
              onChange={(e) => setConfig({ ...config, krinai_api_key: e.target.value })}
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Generate this key from your Krinai dashboard settings under Webhooks & API.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={handleRegisterWebhook} 
            disabled={disabled || isRegisteringWebhook || !config.krinai_api_key}
          >
            {isRegisteringWebhook ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registering Webhook...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Register Webhook manually
              </>
            )}
          </Button>
          <Button onClick={handleSave} disabled={disabled || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save & Connect
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
