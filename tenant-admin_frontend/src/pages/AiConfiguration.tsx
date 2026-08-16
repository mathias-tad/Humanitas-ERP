import { useState, useEffect, useCallback } from 'react';
import { Search, Key, Zap, ToggleLeft, ToggleRight, Save, Loader2, CheckCircle, Globe, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import type { Tenant } from '@/types/tenant';

interface AiSettings {
  tenant_id: string;
  provider: string;
  is_enabled: boolean;
  max_tokens: number;
  temperature: number;
  model?: string;
  endpoint_url?: string;
  gcp_project_id?: string;
  gcp_location?: string;
  api_key_encrypted?: string;
}

interface TenantWithAi extends Tenant {
  aiSettings?: AiSettings;
}

const PROVIDERS = [
  { value: 'gemini',    label: 'Google Gemini' },
  { value: 'vertex',   label: 'Google Vertex AI (Gemini)' },
  { value: 'openai',   label: 'OpenAI (GPT-4)' },
  { value: 'anthropic',label: 'Anthropic (Claude)' },
  { value: 'ollama',   label: 'Ollama (Local)' },
];

const GCP_LOCATIONS = [
  'us-central1', 'us-east1', 'us-east4', 'us-west1', 'us-west4',
  'europe-west1', 'europe-west2', 'europe-west4', 'europe-west6',
  'asia-east1', 'asia-northeast1', 'asia-southeast1',
];

const GLOBAL_TENANT_ID = '00000000-0000-0000-0000-000000000000';

const defaultForm = {
  api_key: '',
  is_enabled: false,
  max_tokens: 4096,
  temperature: 0.7,
  provider: 'gemini',
  model: '',
  endpoint_url: '',
  gcp_project_id: '',
  gcp_location: 'us-central1',
};

type FormState = typeof defaultForm;

// ─── Shared Provider Fields Component ────────────────────────────────────────
function ProviderFields({ form, setForm, testing, onTest }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; testing: boolean; onTest: () => void }) {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <>
      {/* Provider */}
      <div>
        <Label>AI Provider</Label>
        <select
          className="flex mt-1 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={form.provider}
          onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
        >
          {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {/* API Key — hidden for Vertex (uses its own key field below) */}
      {form.provider !== 'vertex' && (
        <div>
          <Label>{form.provider === 'ollama' ? 'Ollama Base URL' : 'API Key'}</Label>
          <div className="relative mt-1">
            <Input
              type={form.provider === 'ollama' || showApiKey ? 'text' : 'password'}
              placeholder={
                form.provider === 'ollama'
                  ? 'http://host.docker.internal:11434'
                  : 'Leave blank to keep existing key'
              }
              value={form.api_key}
              onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
              className="font-mono pr-10"
            />
            {form.provider !== 'ollama' && (
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
          {form.provider === 'ollama' && (
            <p className="text-xs text-amber-600 mt-1">
              ⚠️ Use <code className="bg-amber-50 px-1 rounded">host.docker.internal</code> instead of <code className="bg-amber-50 px-1 rounded">localhost</code> to reach the host machine from Docker.
            </p>
          )}
        </div>
      )}

      {/* Vertex-specific fields */}
      {form.provider === 'vertex' && (
        <div className="space-y-3 border border-blue-200 bg-blue-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Google Vertex AI Settings</p>

          <div>
            <Label>GCP Project ID</Label>
            <Input
              placeholder="my-gcp-project-123"
              value={form.gcp_project_id}
              onChange={e => setForm(f => ({ ...f, gcp_project_id: e.target.value }))}
              className="mt-1 font-mono"
            />
          </div>

          <div>
            <Label>GCP Location / Region</Label>
            <select
              className="flex mt-1 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.gcp_location}
              onChange={e => setForm(f => ({ ...f, gcp_location: e.target.value }))}
            >
              {GCP_LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>

          <div>
            <Label>Vertex AI API Key</Label>
            <div className="relative mt-1">
              <Input
                type={showApiKey ? 'text' : 'password'}
                placeholder="AQ.Ab8RN6I6xp… (leave blank to keep existing)"
                value={form.api_key}
                onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                className="font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              ℹ️ Paste your Vertex AI API key. It will be stored encrypted at rest.
            </p>
          </div>
        </div>
      )}

      {/* Model field — shown for all providers */}
      <div>
        <Label>Model <span className="text-gray-400 font-normal">(optional)</span></Label>
        <Input
          placeholder={
            form.provider === 'gemini' ? 'e.g. gemini-2.0-flash, gemini-1.5-pro' :
            form.provider === 'vertex' ? 'e.g. gemini-2.0-flash-001, gemini-1.5-pro-001' :
            form.provider === 'openai' ? 'e.g. gpt-4o, gpt-4-turbo' :
            form.provider === 'anthropic' ? 'e.g. claude-3-5-sonnet-20241022' :
            form.provider === 'ollama' ? 'e.g. llama3, mistral, phi3' :
            'Model name'
          }
          value={form.model}
          onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
          className="mt-1 font-mono"
        />
        <p className="text-xs text-gray-400 mt-1">Leave blank to use the provider default model.</p>
      </div>

      {/* Endpoint URL for OpenAI / Anthropic custom deployments */}
      {(form.provider === 'openai' || form.provider === 'anthropic') && (
        <div>
          <Label>Custom Endpoint URL <span className="text-gray-400 font-normal">(optional)</span></Label>
          <Input
            placeholder="https://api.openai.com/v1"
            value={form.endpoint_url}
            onChange={e => setForm(f => ({ ...f, endpoint_url: e.target.value }))}
            className="mt-1 font-mono"
          />
          <p className="text-xs text-gray-400 mt-1">Leave blank to use the default provider endpoint.</p>
        </div>
      )}

      {/* Token / Temperature */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Max Tokens
          </Label>
          <Input
            type="number"
            min={256}
            max={32768}
            value={form.max_tokens}
            onChange={e => setForm(f => ({ ...f, max_tokens: Number(e.target.value) }))}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Temperature</Label>
          <Input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={form.temperature}
            onChange={e => setForm(f => ({ ...f, temperature: Number(e.target.value) }))}
            className="mt-1"
          />
        </div>
      </div>

      <div className="pt-4 mt-2">
        <Button variant="outline" type="button" onClick={onTest} disabled={testing} className="text-gray-700 w-full sm:w-auto">
          {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
          Test Connection
        </Button>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AiConfiguration() {
  const [tenants, setTenants] = useState<TenantWithAi[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Global settings state
  const [globalForm, setGlobalForm] = useState<FormState>(defaultForm);
  const [globalSaving, setGlobalSaving] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(true);
  const [globalHasKey, setGlobalHasKey] = useState(false);

  // Per-tenant dialog state
  const [configTenant, setConfigTenant] = useState<TenantWithAi | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [tenantHasKey, setTenantHasKey] = useState(false);
  const [testing, setTesting] = useState(false);

  // ── Test Connection ───────────────────────────────────────────────────────
  const handleTest = async (currentForm: FormState) => {
    try {
      setTesting(true);
      const payload: Record<string, unknown> = {
        provider: currentForm.provider,
        model: currentForm.model || undefined,
        endpoint_url: currentForm.endpoint_url || undefined,
        gcp_project_id: currentForm.gcp_project_id || undefined,
        gcp_location: currentForm.gcp_location || undefined,
      };
      if (currentForm.api_key.trim()) {
        payload.api_key = currentForm.api_key.trim();
      }
      const res = await api.post<{ success: boolean; message: string }>('/admin/ai-settings/test', payload);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error('Test failed: ' + res.message);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  // ── Load global settings ──────────────────────────────────────────────────
  const fetchGlobal = useCallback(async () => {
    try {
      setGlobalLoading(true);
      const s = await api.get<AiSettings>(`/admin/ai-settings/${GLOBAL_TENANT_ID}`);
      setGlobalHasKey(!!s.api_key_encrypted);
      setGlobalForm({
        api_key: '',
        is_enabled: s.is_enabled ?? false,
        max_tokens: s.max_tokens ?? 4096,
        temperature: s.temperature ?? 0.7,
        provider: s.provider ?? 'gemini',
        model: s.model ?? '',
        endpoint_url: s.endpoint_url ?? '',
        gcp_project_id: s.gcp_project_id ?? '',
        gcp_location: s.gcp_location ?? 'us-central1',
      });
    } catch {
      // No global settings yet — use defaults
    } finally {
      setGlobalLoading(false);
    }
  }, []);

  // ── Load tenants ──────────────────────────────────────────────────────────
  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ data: Tenant[]; total: number }>('/tenants');
      setTenants(response.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGlobal();
    fetchTenants();
  }, [fetchGlobal, fetchTenants]);

  // ── Save global settings ──────────────────────────────────────────────────
  async function saveGlobal() {
    try {
      setGlobalSaving(true);
      const payload: Record<string, unknown> = {
        is_enabled: globalForm.is_enabled,
        max_tokens: Number(globalForm.max_tokens),
        temperature: Number(globalForm.temperature),
        provider: globalForm.provider,
        model: globalForm.model || undefined,
        endpoint_url: globalForm.endpoint_url || undefined,
        gcp_project_id: globalForm.gcp_project_id || undefined,
        gcp_location: globalForm.gcp_location || undefined,
      };
      if (globalForm.api_key.trim()) payload.api_key = globalForm.api_key.trim();
      await api.post(`/admin/ai-settings/${GLOBAL_TENANT_ID}`, payload);
      toast.success('Global AI settings saved');
      fetchGlobal();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save global settings');
    } finally {
      setGlobalSaving(false);
    }
  }

  // ── Open per-tenant dialog ────────────────────────────────────────────────
  async function openConfig(tenant: TenantWithAi) {
    setConfigTenant(tenant);
    setTenantHasKey(false);
    setForm(defaultForm);
    setDialogOpen(true);
    try {
      const s = await api.get<AiSettings>(`/admin/ai-settings/${tenant.id}`);
      setTenantHasKey(!!s.api_key_encrypted);
      setForm({
        api_key: '',
        is_enabled: s.is_enabled ?? false,
        max_tokens: s.max_tokens ?? 4096,
        temperature: s.temperature ?? 0.7,
        provider: s.provider ?? 'gemini',
        model: s.model ?? '',
        endpoint_url: s.endpoint_url ?? '',
        gcp_project_id: s.gcp_project_id ?? '',
        gcp_location: s.gcp_location ?? 'us-central1',
      });
    } catch { /* leave defaults */ }
  }

  // ── Save per-tenant settings ──────────────────────────────────────────────
  async function handleSave() {
    if (!configTenant) return;
    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        is_enabled: form.is_enabled,
        max_tokens: Number(form.max_tokens),
        temperature: Number(form.temperature),
        provider: form.provider,
        model: form.model || undefined,
        endpoint_url: form.endpoint_url || undefined,
        gcp_project_id: form.gcp_project_id || undefined,
        gcp_location: form.gcp_location || undefined,
      };
      if (form.api_key.trim()) payload.api_key = form.api_key.trim();
      await api.post(`/admin/ai-settings/${configTenant.id}`, payload);
      toast.success(`AI settings saved for ${configTenant.company_name}`);
      setDialogOpen(false);
      fetchTenants();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  const filtered = tenants.filter(t =>
    t.company_name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Configuration</h1>
        <p className="text-gray-500 mt-1">Set global AI defaults and configure credentials per tenant</p>
      </div>

      {/* ── Global AI Settings Card ── */}
      <Card className="border-2 border-blue-200">
        <CardHeader className="border-b bg-blue-50 rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-blue-900">Global AI Defaults</CardTitle>
              <p className="text-sm text-blue-600 mt-0.5">
                These settings apply to <strong>all tenants</strong> that don't have their own override configured.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto text-blue-600"
              onClick={fetchGlobal}
              disabled={globalLoading}
            >
              <RefreshCw className={`w-4 h-4 ${globalLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {globalLoading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Enable toggle */}
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setGlobalForm(f => ({ ...f, is_enabled: !f.is_enabled }))}>
                  {globalForm.is_enabled
                    ? <ToggleRight className="w-8 h-8 text-blue-600" />
                    : <ToggleLeft className="w-8 h-8 text-gray-400" />}
                </button>
                <div>
                  <Label>{globalForm.is_enabled ? 'AI Enabled (default)' : 'AI Disabled (default)'}</Label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Tenants without an override will inherit this setting
                  </p>
                </div>
              </div>

              {globalHasKey && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle className="w-4 h-4" />
                  Global API key is saved and encrypted. Enter a new value below to replace it.
                </div>
              )}

              <ProviderFields form={globalForm} setForm={setGlobalForm} testing={testing} onTest={() => handleTest(globalForm)} />

              <div className="flex justify-end pt-2 border-t">
                <Button
                  onClick={saveGlobal}
                  disabled={globalSaving}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {globalSaving
                    ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    : <Save className="w-4 h-4 mr-2" />}
                  Save Global Settings
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Per-Tenant Table ── */}
      <Card>
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Per-Tenant Overrides</CardTitle>
              <p className="text-sm text-gray-500 mt-0.5">Override global settings for individual tenants</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search tenants..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>AI Enabled</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(tenant => (
                    <TableRow key={tenant.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-900">{tenant.company_name}</p>
                          <p className="text-xs text-gray-500">{tenant.slug}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={tenant.subscription_status === 'active' ? 'default' : 'secondary'}
                          className="capitalize"
                        >
                          {tenant.subscription_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tenant.aiSettings?.is_enabled ? (
                          <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                            <CheckCircle className="w-4 h-4" /> Enabled
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">Uses global</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600 capitalize">
                          {tenant.aiSettings?.provider
                            ? PROVIDERS.find(p => p.value === tenant.aiSettings?.provider)?.label ?? tenant.aiSettings.provider
                            : <span className="text-gray-400">—</span>}
                        </span>
                      </TableCell>
                      <TableCell>
                        {tenant.aiSettings?.api_key_encrypted ? (
                          <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">••••••••</span>
                        ) : (
                          <span className="text-xs text-gray-400">Uses global</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openConfig(tenant)}>
                          <Key className="w-3.5 h-3.5 mr-1.5" /> Configure
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-400 py-10">
                        No tenants found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Per-Tenant Config Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Override — {configTenant?.company_name}</DialogTitle>
            <p className="text-sm text-gray-500">
              Settings here override the global defaults only for this tenant.
            </p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Enable toggle */}
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setForm(f => ({ ...f, is_enabled: !f.is_enabled }))}>
                {form.is_enabled
                  ? <ToggleRight className="w-8 h-8 text-blue-600" />
                  : <ToggleLeft className="w-8 h-8 text-gray-400" />}
              </button>
              <Label>{form.is_enabled ? 'AI Enabled' : 'AI Disabled'}</Label>
            </div>

            {tenantHasKey && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <CheckCircle className="w-4 h-4" />
                API key already saved. Enter a new value to replace it.
              </div>
            )}

            <ProviderFields form={form} setForm={setForm} testing={testing} onTest={() => handleTest(form)} />
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving || testing}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || testing} className="bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
