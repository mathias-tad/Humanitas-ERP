import { useState, useEffect } from 'react';
import { Globe, Mail, Database, Shield, Loader2, Save, TestTube, Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';

interface GeneralSettings {
  platform_name: string;
  domain: string;
  support_email: string;
  default_trial_days: number;
  max_tenants: number;
}

interface EmailSettings {
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password: string | null;
  from_email: string | null;
}

interface DatabaseSettings {
  db_host: string;
  db_port: number;
  master_db_name: string;
  tenant_db_prefix: string;
}

interface SecuritySettings {
  session_timeout_minutes: number;
  max_login_attempts: number;
  password_min_length: number;
  lockout_duration_minutes: number;
  require_2fa_for_admins: boolean;
}

interface ServicesSettings {
  redis_url: string;
  redis_enabled: boolean;
  calculation_service_url: string;
}

export default function Settings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  
  const [general, setGeneral] = useState<GeneralSettings>({
    platform_name: '',
    domain: '',
    support_email: '',
    default_trial_days: 14,
    max_tenants: 1000,
  });

  const [email, setEmail] = useState<EmailSettings>({
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    from_email: '',
  });

  const [database, setDatabase] = useState<DatabaseSettings>({
    db_host: 'localhost',
    db_port: 5432,
    master_db_name: 'master_db',
    tenant_db_prefix: 'tenant_',
  });

  const [security, setSecurity] = useState<SecuritySettings>({
    session_timeout_minutes: 60,
    max_login_attempts: 5,
    password_min_length: 8,
    lockout_duration_minutes: 15,
    require_2fa_for_admins: false,
  });

  const [services, setServices] = useState<ServicesSettings>({
    redis_url: '',
    redis_enabled: false,
    calculation_service_url: 'http://localhost:8000',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<any>('/settings');
      setGeneral({
        platform_name: data.platform_name || '',
        domain: data.domain || '',
        support_email: data.support_email || '',
        default_trial_days: data.default_trial_days || 14,
        max_tenants: data.max_tenants || 1000,
      });
      setEmail({
        smtp_host: data.smtp_host || '',
        smtp_port: data.smtp_port || 587,
        smtp_username: data.smtp_username || '',
        smtp_password: data.smtp_password || '',
        from_email: data.from_email || '',
      });
      setDatabase({
        db_host: data.db_host || 'localhost',
        db_port: data.db_port || 5432,
        master_db_name: data.master_db_name || 'master_db',
        tenant_db_prefix: data.tenant_db_prefix || 'tenant_',
      });
      setSecurity({
        session_timeout_minutes: data.session_timeout_minutes || 60,
        max_login_attempts: data.max_login_attempts || 5,
        password_min_length: data.password_min_length || 8,
        lockout_duration_minutes: data.lockout_duration_minutes || 15,
        require_2fa_for_admins: data.require_2fa_for_admins || false,
      });
      setServices({
        redis_url: data.redis_url || '',
        redis_enabled: data.redis_enabled || false,
        calculation_service_url: data.calculation_service_url || 'http://localhost:8000',
      });
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveGeneral = async () => {
    setIsSaving(true);
    try {
      await api.patch('/settings/general', general);
      alert('General settings saved successfully');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEmail = async () => {
    setIsSaving(true);
    try {
      await api.patch('/settings/email', email);
      alert('Email settings saved successfully');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    try {
      const result = await api.post<{ success: boolean; message: string }>('/settings/email/test');
      alert(result.message);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to test connection');
    }
  };

  const handleSaveDatabase = async () => {
    setIsSaving(true);
    try {
      await api.patch('/settings/database', database);
      alert('Database settings saved successfully');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSecurity = async () => {
    setIsSaving(true);
    try {
      await api.patch('/settings/security', security);
      alert('Security settings saved successfully');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveServices = async () => {
    setIsSaving(true);
    try {
      await api.patch('/settings/services', services);
      alert('Services settings saved successfully');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestRedis = async () => {
    try {
      const result = await api.post<{ success: boolean; message: string }>('/settings/services/test-redis', {
        redis_url: services.redis_url,
      });
      alert(result.message);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to test Redis connection');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure your SaaS platform settings</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Globe className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Platform Settings</CardTitle>
                  <CardDescription>Basic configuration for your SaaS platform</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Platform Name</Label>
                  <Input
                    value={general.platform_name}
                    onChange={(e) => setGeneral({ ...general, platform_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Domain</Label>
                  <Input
                    value={general.domain}
                    onChange={(e) => setGeneral({ ...general, domain: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Support Email</Label>
                  <Input
                    type="email"
                    value={general.support_email}
                    onChange={(e) => setGeneral({ ...general, support_email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Trial Days</Label>
                  <Input
                    type="number"
                    value={general.default_trial_days}
                    onChange={(e) => setGeneral({ ...general, default_trial_days: parseInt(e.target.value) || 14 })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Maximum Tenants</Label>
                <Input
                  type="number"
                  value={general.max_tenants}
                  onChange={(e) => setGeneral({ ...general, max_tenants: parseInt(e.target.value) || 1000 })}
                />
                <p className="text-xs text-gray-500">Maximum number of tenants allowed on the platform</p>
              </div>
              <Separator />
              <Button
                onClick={handleSaveGeneral}
                disabled={isSaving}
                style={{ backgroundColor: '#2563eb', color: 'white' }}
              >
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Mail className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle>Email Configuration</CardTitle>
                  <CardDescription>Configure email settings for notifications</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>SMTP Host</Label>
                  <Input
                    placeholder="smtp.example.com"
                    value={email.smtp_host || ''}
                    onChange={(e) => setEmail({ ...email, smtp_host: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Port</Label>
                  <Input
                    type="number"
                    placeholder="587"
                    value={email.smtp_port || ''}
                    onChange={(e) => setEmail({ ...email, smtp_port: parseInt(e.target.value) || 587 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>SMTP Username</Label>
                  <Input
                    placeholder="username"
                    value={email.smtp_username || ''}
                    onChange={(e) => setEmail({ ...email, smtp_username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Password</Label>
                  <Input
                    type="password"
                    placeholder="********"
                    value={email.smtp_password || ''}
                    onChange={(e) => setEmail({ ...email, smtp_password: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>From Email</Label>
                <Input
                  type="email"
                  placeholder="noreply@yoursaas.com"
                  value={email.from_email || ''}
                  onChange={(e) => setEmail({ ...email, from_email: e.target.value })}
                />
              </div>
              <Separator />
              <div className="flex gap-3">
                <Button
                  onClick={handleSaveEmail}
                  disabled={isSaving}
                  style={{ backgroundColor: '#2563eb', color: 'white' }}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Changes
                </Button>
                <Button variant="outline" onClick={handleTestEmail}>
                  <TestTube className="h-4 w-4 mr-2" />
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Database className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle>Database Configuration</CardTitle>
                  <CardDescription>Configure database settings for tenant provisioning</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Database Host</Label>
                  <Input
                    value={database.db_host}
                    onChange={(e) => setDatabase({ ...database, db_host: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Database Port</Label>
                  <Input
                    type="number"
                    value={database.db_port}
                    onChange={(e) => setDatabase({ ...database, db_port: parseInt(e.target.value) || 5432 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Master Database Name</Label>
                  <Input
                    value={database.master_db_name}
                    onChange={(e) => setDatabase({ ...database, master_db_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tenant DB Prefix</Label>
                  <Input
                    value={database.tenant_db_prefix}
                    onChange={(e) => setDatabase({ ...database, tenant_db_prefix: e.target.value })}
                  />
                </div>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Database credentials are managed through environment variables for security.
                </p>
              </div>
              <Separator />
              <Button
                onClick={handleSaveDatabase}
                disabled={isSaving}
                style={{ backgroundColor: '#2563eb', color: 'white' }}
              >
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Shield className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>Configure security and authentication settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Session Timeout (minutes)</Label>
                  <Input
                    type="number"
                    value={security.session_timeout_minutes}
                    onChange={(e) => setSecurity({ ...security, session_timeout_minutes: parseInt(e.target.value) || 60 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Login Attempts</Label>
                  <Input
                    type="number"
                    value={security.max_login_attempts}
                    onChange={(e) => setSecurity({ ...security, max_login_attempts: parseInt(e.target.value) || 5 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Password Min Length</Label>
                  <Input
                    type="number"
                    value={security.password_min_length}
                    onChange={(e) => setSecurity({ ...security, password_min_length: parseInt(e.target.value) || 8 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lockout Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={security.lockout_duration_minutes}
                    onChange={(e) => setSecurity({ ...security, lockout_duration_minutes: parseInt(e.target.value) || 15 })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">Require 2FA for Admins</p>
                  <p className="text-sm text-gray-500">Force all admin users to enable two-factor authentication</p>
                </div>
                <Button
                  variant={security.require_2fa_for_admins ? 'default' : 'outline'}
                  onClick={() => setSecurity({ ...security, require_2fa_for_admins: !security.require_2fa_for_admins })}
                  style={security.require_2fa_for_admins ? { backgroundColor: '#2563eb', color: 'white' } : {}}
                >
                  {security.require_2fa_for_admins ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
              <Separator />
              <Button
                onClick={handleSaveSecurity}
                disabled={isSaving}
                style={{ backgroundColor: '#2563eb', color: 'white' }}
              >
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Server className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle>External Services</CardTitle>
                  <CardDescription>Configure Redis (Upstash) and calculation service settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">Enable Job Queue (Redis)</p>
                  <p className="text-sm text-gray-500">Use Redis for background job processing (payroll, KPI calculations)</p>
                </div>
                <Button
                  variant={services.redis_enabled ? 'default' : 'outline'}
                  onClick={() => setServices({ ...services, redis_enabled: !services.redis_enabled })}
                  style={services.redis_enabled ? { backgroundColor: '#2563eb', color: 'white' } : {}}
                >
                  {services.redis_enabled ? 'Enabled' : 'Disabled'}
                </Button>
              </div>

              {services.redis_enabled && (
                <>
                  <div className="space-y-2">
                    <Label>Redis URL (Upstash)</Label>
                    <Input
                      type="password"
                      placeholder="rediss://default:xxxxx@xxxxx.upstash.io:6379"
                      value={services.redis_url}
                      onChange={(e) => setServices({ ...services, redis_url: e.target.value })}
                    />
                    <p className="text-xs text-gray-500">
                      Get your Redis URL from <a href="https://console.upstash.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Upstash Console</a>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Calculation Service URL</Label>
                    <Input
                      placeholder="http://localhost:8000"
                      value={services.calculation_service_url}
                      onChange={(e) => setServices({ ...services, calculation_service_url: e.target.value })}
                    />
                    <p className="text-xs text-gray-500">URL of the FastAPI calculation service</p>
                  </div>
                </>
              )}

              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> The calculation service handles payroll calculations, KPI analytics, and report generation in the background.
                </p>
              </div>

              <Separator />
              <div className="flex gap-3">
                <Button
                  onClick={handleSaveServices}
                  disabled={isSaving}
                  style={{ backgroundColor: '#2563eb', color: 'white' }}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Changes
                </Button>
                {services.redis_enabled && services.redis_url && (
                  <Button variant="outline" onClick={handleTestRedis}>
                    <TestTube className="h-4 w-4 mr-2" />
                    Test Redis Connection
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
