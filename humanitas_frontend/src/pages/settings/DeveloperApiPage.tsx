import React, { useState } from 'react';
import { PageHeader } from '@/components/design-system/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Key,
  Webhook,
  Activity,
  Code2,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Send,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Terminal,
} from 'lucide-react';
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  useApiKeyLogs,
  useWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  useTestWebhook,
  useWebhookDeliveries,
  useRetryWebhookDelivery,
  AVAILABLE_API_SCOPES,
  AVAILABLE_WEBHOOK_EVENTS,
  type ApiKey,
  type WebhookSubscription,
  type WebhookDeliveryLog,
} from '@/hooks/useDeveloperApi';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export default function DeveloperApiPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_developer_api');

  const [activeTab, setActiveTab] = useState<'keys' | 'webhooks' | 'deliveries' | 'docs'>('keys');

  // API Key Queries & Mutations
  const { data: apiKeys = [], isLoading: keysLoading } = useApiKeys();
  const createKeyMutation = useCreateApiKey();
  const revokeKeyMutation = useRevokeApiKey();

  // Webhook Queries & Mutations
  const { data: webhooks = [], isLoading: webhooksLoading } = useWebhooks();
  const createWebhookMutation = useCreateWebhook();
  const updateWebhookMutation = useUpdateWebhook();
  const deleteWebhookMutation = useDeleteWebhook();
  const testWebhookMutation = useTestWebhook();

  // Deliveries
  const [selectedWebhookFilter, setSelectedWebhookFilter] = useState<string>('all');
  const {
    data: deliveries = [],
    isLoading: deliveriesLoading,
    refetch: refetchDeliveries,
  } = useWebhookDeliveries(selectedWebhookFilter === 'all' ? undefined : selectedWebhookFilter);
  const retryDeliveryMutation = useRetryWebhookDelivery();

  // Key creation state
  const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyRateLimit, setKeyRateLimit] = useState(60);
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['read:users', 'read:attendance']);
  const [createdKeyRawToken, setCreatedKeyRawToken] = useState<string | null>(null);
  const [hasCopiedToken, setHasCopiedToken] = useState(false);

  // Key logs modal
  const [selectedKeyForLogs, setSelectedKeyForLogs] = useState<ApiKey | null>(null);
  const { data: keyLogs = [], isLoading: logsLoading } = useApiKeyLogs(selectedKeyForLogs?.id || null);

  // Webhook creation state
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookSubscription | null>(null);
  const [webhookName, setWebhookName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['attendance.clock_in', 'leave.requested']);

  // Webhook test modal
  const [testingWebhook, setTestingWebhook] = useState<WebhookSubscription | null>(null);
  const [testResult, setTestResult] = useState<{
    status_code: number;
    execution_time_ms: number;
    response_body?: string;
    signature_sent: string;
  } | null>(null);

  // Delivery payload detail modal
  const [selectedDelivery, setSelectedDelivery] = useState<WebhookDeliveryLog | null>(null);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }
    try {
      const res = await createKeyMutation.mutateAsync({
        name: keyName.trim(),
        scopes: selectedScopes,
        rate_limit_rpm: keyRateLimit,
      });
      setKeyName('');
      setSelectedScopes(['read:users', 'read:attendance']);
      setKeyRateLimit(60);
      setIsCreateKeyOpen(false);
      if (res.raw_token) {
        setCreatedKeyRawToken(res.raw_token);
      }
      toast.success('API key created successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate API key');
    }
  };

  const handleRevokeKey = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to revoke API key "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await revokeKeyMutation.mutateAsync(id);
      toast.success(`Key "${name}" revoked`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke key');
    }
  };

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookName.trim() || !webhookUrl.trim()) {
      toast.error('Name and target URL are required');
      return;
    }
    if (selectedEvents.length === 0) {
      toast.error('Select at least one event trigger');
      return;
    }

    try {
      if (editingWebhook) {
        await updateWebhookMutation.mutateAsync({
          id: editingWebhook.id,
          payload: {
            name: webhookName.trim(),
            target_url: webhookUrl.trim(),
            events: selectedEvents,
          },
        });
        toast.success('Webhook updated');
      } else {
        await createWebhookMutation.mutateAsync({
          name: webhookName.trim(),
          target_url: webhookUrl.trim(),
          secret_key: webhookSecret.trim() || undefined,
          events: selectedEvents,
        });
        toast.success('Webhook created');
      }
      setIsWebhookModalOpen(false);
      setEditingWebhook(null);
      setWebhookName('');
      setWebhookUrl('');
      setWebhookSecret('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save webhook');
    }
  };

  const handleDeleteWebhook = async (id: string, name: string) => {
    if (!confirm(`Delete webhook subscription "${name}"?`)) return;
    try {
      await deleteWebhookMutation.mutateAsync(id);
      toast.success(`Webhook "${name}" deleted`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete webhook');
    }
  };

  const handleRunWebhookTest = async () => {
    if (!testingWebhook) return;
    try {
      const res = await testWebhookMutation.mutateAsync({
        target_url: testingWebhook.target_url,
        secret_key: testingWebhook.secret_key,
        event_type: 'webhook.ping',
      });
      setTestResult(res);
      toast.success(`Ping returned status ${res.status_code}`);
    } catch (err: any) {
      toast.error(err.message || 'Webhook test failed');
    }
  };

  const handleRetryDelivery = async (id: string) => {
    try {
      await retryDeliveryMutation.mutateAsync(id);
      toast.success('Delivery retry queued');
    } catch (err: any) {
      toast.error(err.message || 'Failed to retry delivery');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setHasCopiedToken(true);
    setTimeout(() => setHasCopiedToken(false), 2000);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Developer API & Webhooks"
        badge="REST & Events"
        description="Provision programmatic API keys with scoped RBAC, configure HTTPS webhook event subscriptions with HMAC SHA-256 signatures, and inspect real-time delivery telemetry."
        actions={
          <div className="flex items-center gap-2">
            {activeTab === 'keys' && canManage && (
              <Button onClick={() => setIsCreateKeyOpen(true)} className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Generate API Key
              </Button>
            )}
            {activeTab === 'webhooks' && canManage && (
              <Button
                onClick={() => {
                  setEditingWebhook(null);
                  setWebhookName('');
                  setWebhookUrl('');
                  setWebhookSecret('');
                  setSelectedEvents(['attendance.clock_in', 'leave.requested']);
                  setIsWebhookModalOpen(true);
                }}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> Add Webhook
              </Button>
            )}
            {activeTab === 'deliveries' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchDeliveries()}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" /> Refresh Logs
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('keys')}
            className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'keys'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Key className="h-4 w-4" />
            API Keys
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-muted">
              {apiKeys.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('webhooks')}
            className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'webhooks'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Webhook className="h-4 w-4" />
            Webhooks
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-muted">
              {webhooks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('deliveries')}
            className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'deliveries'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Activity className="h-4 w-4" />
            Delivery Telemetry
          </button>

          <button
            onClick={() => setActiveTab('docs')}
            className={`pb-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'docs'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Code2 className="h-4 w-4" />
            Quickstart & Docs
          </button>
        </nav>
      </div>

      {/* TAB 1: API KEYS */}
      {activeTab === 'keys' && (
        <div className="space-y-4">
          {keysLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading API tokens...</div>
          ) : apiKeys.length === 0 ? (
            <div className="p-12 text-center border rounded-xl bg-card space-y-3">
              <Key className="h-10 w-10 mx-auto text-muted-foreground opacity-50" />
              <h3 className="font-semibold text-lg">No API Keys Generated</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Generate an API key to allow external scripts, ERP integrations, and mobile clients to securely authenticate against your workspace.
              </p>
              {canManage && (
                <Button onClick={() => setIsCreateKeyOpen(true)} className="mt-2">
                  <Plus className="h-4 w-4 mr-2" /> Generate First Key
                </Button>
              )}
            </div>
          ) : (
            <div className="border rounded-xl bg-card overflow-hidden divide-y divide-border">
              {apiKeys.map((key) => (
                <div key={key.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-base">{key.name}</span>
                      <code className="px-2 py-0.5 rounded text-xs bg-muted font-mono text-muted-foreground">
                        {key.key_prefix}...
                      </code>
                      {key.is_active ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">
                          Revoked
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Rate limit: {key.rate_limit_rpm} RPM</span>
                      <span>•</span>
                      <span>Created: {new Date(key.created_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>
                        Last used: {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : 'Never'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {key.scopes?.map((s) => (
                        <span key={s} className="px-1.5 py-0.5 text-[10px] rounded bg-secondary font-mono">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedKeyForLogs(key)}
                      className="text-xs"
                    >
                      <Activity className="h-3.5 w-3.5 mr-1" /> Activity Logs
                    </Button>
                    {canManage && key.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeKey(key.id, key.name)}
                        className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WEBHOOKS */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          {webhooksLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading webhooks...</div>
          ) : webhooks.length === 0 ? (
            <div className="p-12 text-center border rounded-xl bg-card space-y-3">
              <Webhook className="h-10 w-10 mx-auto text-muted-foreground opacity-50" />
              <h3 className="font-semibold text-lg">No Webhook Subscriptions</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Subscribe to real-time enterprise events like clock-ins, leave approvals, sprint completions, and new hires delivered directly to your HTTPS endpoints.
              </p>
              {canManage && (
                <Button
                  onClick={() => {
                    setEditingWebhook(null);
                    setWebhookName('');
                    setWebhookUrl('');
                    setWebhookSecret('');
                    setSelectedEvents(['attendance.clock_in', 'leave.requested']);
                    setIsWebhookModalOpen(true);
                  }}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add First Webhook
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {webhooks.map((wh) => (
                <div key={wh.id} className="border rounded-xl bg-card p-5 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-base">{wh.name}</h4>
                        <code className="text-xs text-muted-foreground break-all">{wh.target_url}</code>
                      </div>
                      {canManage && (
                        <Switch
                          checked={wh.is_active}
                          onCheckedChange={(checked) =>
                            updateWebhookMutation.mutate({ id: wh.id, payload: { is_active: checked } })
                          }
                        />
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {wh.events?.map((ev) => (
                        <span key={ev} className="px-2 py-0.5 text-[11px] rounded bg-secondary font-mono">
                          {ev}
                        </span>
                      ))}
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center justify-between pt-1">
                      <span>Failures: {wh.failure_count}</span>
                      <span>
                        Last Triggered: {wh.last_triggered_at ? new Date(wh.last_triggered_at).toLocaleString() : 'Never'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTestingWebhook(wh);
                        setTestResult(null);
                      }}
                      className="text-xs"
                    >
                      <Send className="h-3.5 w-3.5 mr-1" /> Test Ping
                    </Button>
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingWebhook(wh);
                            setWebhookName(wh.name);
                            setWebhookUrl(wh.target_url);
                            setWebhookSecret(wh.secret_key);
                            setSelectedEvents(wh.events || []);
                            setIsWebhookModalOpen(true);
                          }}
                          className="text-xs"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteWebhook(wh.id, wh.name)}
                          className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DELIVERY LOGS */}
      {activeTab === 'deliveries' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter by Webhook:</span>
              <Select value={selectedWebhookFilter} onValueChange={setSelectedWebhookFilter}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="All Webhooks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Webhooks</SelectItem>
                  {webhooks.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {deliveriesLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading delivery history...</div>
          ) : deliveries.length === 0 ? (
            <div className="p-12 text-center border rounded-xl bg-card">
              <Activity className="h-8 w-8 mx-auto text-muted-foreground opacity-50 mb-2" />
              <p className="text-sm text-muted-foreground">No webhook event deliveries recorded yet.</p>
            </div>
          ) : (
            <div className="border rounded-xl bg-card overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b text-xs text-muted-foreground uppercase font-medium">
                  <tr>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Event Type</th>
                    <th className="px-4 py-3">Webhook</th>
                    <th className="px-4 py-3">Attempts</th>
                    <th className="px-4 py-3">Latency</th>
                    <th className="px-4 py-3">Delivered At</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deliveries.map((del) => {
                    const isSuccess = del.status_code && del.status_code >= 200 && del.status_code < 300;
                    return (
                      <tr key={del.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-mono">
                          {isSuccess ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
                              <CheckCircle2 className="h-3 w-3 mr-1 inline" /> {del.status_code} OK
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">
                              <XCircle className="h-3 w-3 mr-1 inline" /> {del.status_code || 'Failed'}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{del.event_type}</td>
                        <td className="px-4 py-3 font-medium">{del.webhook_name || 'Webhook'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{del.attempts}</td>
                        <td className="px-4 py-3 text-muted-foreground">{del.execution_time_ms ? `${del.execution_time_ms} ms` : '-'}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(del.delivered_at).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedDelivery(del)}
                            className="text-xs"
                          >
                            Payload
                          </Button>
                          {canManage && !isSuccess && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetryDelivery(del.id)}
                              className="text-xs"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" /> Retry
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: QUICKSTART & DOCS */}
      {activeTab === 'docs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="border rounded-xl bg-card p-5 space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Terminal className="h-5 w-5 text-primary" /> API Authentication
              </h3>
              <p className="text-sm text-muted-foreground">
                All REST API calls must send the Bearer token in the <code className="text-primary font-mono">Authorization</code> HTTP header, along with your workspace tenant identifier:
              </p>
              <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto space-y-1">
                <div>curl -X GET https://api.humanitas.com/api/v1/users/me \</div>
                <div className="pl-4">-H "Authorization: Bearer hk_live_xxxxxxxxxxxxxxxx" \</div>
                <div className="pl-4">-H "x-tenant-id: your_tenant_slug" \</div>
                <div className="pl-4">-H "Content-Type: application/json"</div>
              </div>
            </div>

            <div className="border rounded-xl bg-card p-5 space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" /> Webhook HMAC Verification (Node.js)
              </h3>
              <p className="text-sm text-muted-foreground">
                Outgoing webhook POST requests contain a cryptographic signature in the <code className="text-primary font-mono">x-humanitas-signature</code> header:
              </p>
              <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto space-y-1">
                <div className="text-muted-foreground">// Verify HMAC SHA-256</div>
                <div>const crypto = require('crypto');</div>
                <div>const expected = 'sha256=' + crypto</div>
                <div className="pl-4">.createHmac('sha256', secretKey)</div>
                <div className="pl-4">.update(rawRequestBody)</div>
                <div className="pl-4">.digest('hex');</div>
                <div>if (req.headers['x-humanitas-signature'] === expected) &#123;</div>
                <div className="pl-4">// Signature is valid!</div>
                <div>&#125;</div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border rounded-xl bg-card p-5 space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-600" /> Webhook HMAC Verification (Python)
              </h3>
              <p className="text-sm text-muted-foreground">
                Verify webhook event payloads securely inside FastAPI or Flask using standard library hashing:
              </p>
              <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto space-y-1">
                <div className="text-muted-foreground"># Verify HMAC SHA-256 in Python</div>
                <div>import hmac, hashlib</div>
                <div>expected = 'sha256=' + hmac.new(</div>
                <div className="pl-4">secret_key.encode('utf-8'),</div>
                <div className="pl-4">raw_request_body,</div>
                <div className="pl-4">hashlib.sha256</div>
                <div>).hexdigest()</div>
                <div>if hmac.compare_digest(req_sig, expected):</div>
                <div className="pl-4">process_enterprise_event(payload)</div>
              </div>
            </div>

            <div className="border rounded-xl bg-card p-5 space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Code2 className="h-5 w-5 text-primary" /> Supported Event Categories
              </h3>
              <p className="text-sm text-muted-foreground">
                Events dispatched across the Humanitas enterprise ecosystem:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 border rounded bg-muted/40">
                  <div className="font-medium text-foreground">HRMS & Attendance</div>
                  <div className="text-muted-foreground text-[11px]">employee.*, attendance.*, leave.*, payroll.*</div>
                </div>
                <div className="p-2 border rounded bg-muted/40">
                  <div className="font-medium text-foreground">PMS & Projects</div>
                  <div className="text-muted-foreground text-[11px]">pms.task_completed, pms.sprint_closed</div>
                </div>
                <div className="p-2 border rounded bg-muted/40">
                  <div className="font-medium text-foreground">Dynamic Approvals</div>
                  <div className="text-muted-foreground text-[11px]">approval.pending, approval.decision</div>
                </div>
                <div className="p-2 border rounded bg-muted/40">
                  <div className="font-medium text-foreground">Hardware & Biometrics</div>
                  <div className="text-muted-foreground text-[11px]">device.status_changed, adms.heartbeat</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Generate API Key */}
      <Dialog open={isCreateKeyOpen} onOpenChange={setIsCreateKeyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate New API Key</DialogTitle>
            <DialogDescription>
              Create a scoped API token for external systems. You will only be shown the raw token once.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateKey} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Key Name / Description</label>
              <Input
                placeholder="e.g. Zapier Attendance Sync, Mobile CI Pipeline"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Rate Limit (Requests per minute)</label>
              <Input
                type="number"
                min="10"
                max="600"
                value={keyRateLimit}
                onChange={(e) => setKeyRateLimit(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Scopes & Permissions</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg bg-muted/20">
                {AVAILABLE_API_SCOPES.map((sc) => {
                  const checked = selectedScopes.includes(sc.scope);
                  return (
                    <label
                      key={sc.scope}
                      className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedScopes([...selectedScopes, sc.scope]);
                          } else {
                            setSelectedScopes(selectedScopes.filter((s) => s !== sc.scope));
                          }
                        }}
                      />
                      <span>{sc.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateKeyOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createKeyMutation.isPending}>
                {createKeyMutation.isPending ? 'Generating...' : 'Generate Key'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Newly Created Raw Token Display */}
      <Dialog open={Boolean(createdKeyRawToken)} onOpenChange={() => setCreatedKeyRawToken(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" /> API Key Created
            </DialogTitle>
            <DialogDescription>
              Please copy your new API key now. For your security, this key will never be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-lg flex items-start gap-2 text-amber-800 dark:text-amber-300 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>If you lose this key, you will need to revoke it and generate a new one.</span>
            </div>

            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={createdKeyRawToken || ''}
                className="font-mono text-xs bg-muted"
              />
              <Button
                variant="outline"
                onClick={() => copyToClipboard(createdKeyRawToken || '')}
                className="shrink-0"
              >
                {hasCopiedToken ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedKeyRawToken(null)}>I Have Saved This Key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: API Key Activity Logs */}
      <Dialog open={Boolean(selectedKeyForLogs)} onOpenChange={() => setSelectedKeyForLogs(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Activity Logs: {selectedKeyForLogs?.name}</DialogTitle>
            <DialogDescription>
              Recent HTTP requests authenticated using key prefix {selectedKeyForLogs?.key_prefix}...
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {logsLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading activity logs...</div>
            ) : keyLogs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No activity recorded yet for this API key.
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2">Status</th>
                    <th className="p-2">Method</th>
                    <th className="p-2">Endpoint</th>
                    <th className="p-2">Latency</th>
                    <th className="p-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {keyLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="p-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${log.status_code < 400 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-800'}`}>
                          {log.status_code}
                        </span>
                      </td>
                      <td className="p-2 font-bold">{log.method}</td>
                      <td className="p-2 break-all">{log.endpoint}</td>
                      <td className="p-2 text-muted-foreground">{log.latency_ms ? `${log.latency_ms}ms` : '-'}</td>
                      <td className="p-2 text-muted-foreground">{new Date(log.created_at).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: Add / Edit Webhook */}
      <Dialog open={isWebhookModalOpen} onOpenChange={setIsWebhookModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingWebhook ? 'Edit Webhook' : 'Create Webhook Subscription'}</DialogTitle>
            <DialogDescription>
              Configure target URL and event triggers for automated JSON event delivery.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveWebhook} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Webhook Name</label>
              <Input
                placeholder="e.g. Slack HR Alerts, ERP Bridge"
                value={webhookName}
                onChange={(e) => setWebhookName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Target URL (HTTPS)</label>
              <Input
                type="url"
                placeholder="https://your-domain.com/webhooks/humanitas"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                required
              />
            </div>

            {!editingWebhook && (
              <div className="space-y-1">
                <label className="text-xs font-medium">Secret Key (Optional - Auto-generated if blank)</label>
                <Input
                  placeholder="Leave empty to generate a secure 32-byte secret"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium">Trigger Events</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg bg-muted/20">
                {AVAILABLE_WEBHOOK_EVENTS.map((ev) => {
                  const checked = selectedEvents.includes(ev.event);
                  return (
                    <label
                      key={ev.event}
                      className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEvents([...selectedEvents, ev.event]);
                          } else {
                            setSelectedEvents(selectedEvents.filter((x) => x !== ev.event));
                          }
                        }}
                      />
                      <span>{ev.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsWebhookModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createWebhookMutation.isPending || updateWebhookMutation.isPending}
              >
                {editingWebhook ? 'Update Webhook' : 'Create Webhook'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Test Webhook Ping */}
      <Dialog open={Boolean(testingWebhook)} onOpenChange={() => setTestingWebhook(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Test Webhook: {testingWebhook?.name}</DialogTitle>
            <DialogDescription>
              Send an instant test payload with valid HMAC SHA-256 signature to verify connection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-muted rounded-lg space-y-1 text-xs">
              <div><strong>Target:</strong> {testingWebhook?.target_url}</div>
              <div><strong>Secret:</strong> <code className="font-mono">{testingWebhook?.secret_key.slice(0, 10)}...</code></div>
            </div>

            {testResult && (
              <div className="border rounded-lg p-3 space-y-2 bg-card">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">Test Response:</span>
                  <Badge variant={testResult.status_code >= 200 && testResult.status_code < 300 ? 'default' : 'destructive'}>
                    HTTP {testResult.status_code} ({testResult.execution_time_ms}ms)
                  </Badge>
                </div>
                <div className="font-mono text-[11px] text-muted-foreground break-all">
                  Signature: {testResult.signature_sent}
                </div>
                {testResult.response_body && (
                  <pre className="bg-muted p-2 rounded text-[11px] max-h-32 overflow-y-auto">
                    {testResult.response_body}
                  </pre>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={handleRunWebhookTest}
              disabled={testWebhookMutation.isPending}
              className="flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              {testWebhookMutation.isPending ? 'Sending Ping...' : 'Send Test Ping'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Delivery Log Payload Detail */}
      <Dialog open={Boolean(selectedDelivery)} onOpenChange={() => setSelectedDelivery(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Delivery Payload Inspection</DialogTitle>
            <DialogDescription>
              Event: {selectedDelivery?.event_type} • Status: {selectedDelivery?.status_code || 'Failed'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <span className="text-xs font-semibold">Event Payload (JSON):</span>
              <pre className="mt-1 p-3 bg-muted rounded-lg font-mono text-xs max-h-60 overflow-y-auto">
                {JSON.stringify(selectedDelivery?.payload, null, 2)}
              </pre>
            </div>
            {selectedDelivery?.response_body && (
              <div>
                <span className="text-xs font-semibold">Remote Endpoint Response:</span>
                <pre className="mt-1 p-3 bg-muted rounded-lg font-mono text-xs max-h-32 overflow-y-auto">
                  {selectedDelivery.response_body}
                </pre>
              </div>
            )}
            {selectedDelivery?.error_message && (
              <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-lg">
                <strong>Error:</strong> {selectedDelivery.error_message}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
