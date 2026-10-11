import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  RefreshCw,
  Play,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  GitBranch,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface TenantMigrationStatus {
  database: string;
  totalFiles: number;
  appliedCount: number;
  pendingCount: number;
  applied: string[];
  pending: string[];
}

interface MigrationRunResult {
  message: string;
  migrated: Array<{ tenant: string; applied: string[] }>;
  errors: Array<{ tenant: string; error: string }>;
}

interface PermissionSyncResult {
  message: string;
  results: Array<{ tenant: string; success: boolean; error?: string }>;
}

export default function Migrations() {
  const [statuses, setStatuses] = useState<TenantMigrationStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [runningTenant, setRunningTenant] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.get<TenantMigrationStatus[]>('/tenants/migrations/status');
      setStatuses(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch migration status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleRunAll = async () => {
    setIsRunningAll(true);
    try {
      const result = await api.post<MigrationRunResult>('/tenants/migrations/run');
      if (result.errors.length > 0) {
        toast.warning(`Completed with ${result.errors.length} error(s). ${result.migrated.length} tenants migrated.`);
      } else {
        const totalApplied = result.migrated.reduce((sum, m) => sum + m.applied.length, 0);
        toast.success(
          totalApplied > 0
            ? `Applied ${totalApplied} migration(s) across ${result.migrated.length} tenant(s)`
            : 'All tenants are already up to date'
        );
      }
      await fetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to run migrations');
    } finally {
      setIsRunningAll(false);
    }
  };

  const handleRunTenant = async (tenantSlug: string) => {
    setRunningTenant(tenantSlug);
    try {
      const result = await api.post<MigrationRunResult>(`/tenants/migrations/run?tenantSlug=${tenantSlug}`);
      const migrated = result.migrated[0];
      if (result.errors.length > 0) {
        toast.error(`Migration failed for ${tenantSlug}: ${result.errors[0]?.error}`);
      } else {
        toast.success(
          migrated?.applied?.length
            ? `Applied ${migrated.applied.length} migration(s) to ${tenantSlug}`
            : `${tenantSlug} is already up to date`
        );
      }
      await fetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to migrate ${tenantSlug}`);
    } finally {
      setRunningTenant(null);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      const result = await api.post<PermissionSyncResult>('/tenants/migrations/sync-permissions');
      const failed = result.results.filter((r) => !r.success);
      if (failed.length > 0) {
        toast.warning(`Sync completed with ${failed.length} error(s)`);
      } else {
        toast.success(`Permissions synced across ${result.results.length} tenant(s)`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sync permissions');
    } finally {
      setIsSyncingAll(false);
    }
  };

  const toggleExpand = (database: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(database)) {
        next.delete(database);
      } else {
        next.add(database);
      }
      return next;
    });
  };

  const totalPending = statuses.reduce((sum, s) => sum + s.pendingCount, 0);
  const totalApplied = statuses.reduce((sum, s) => sum + s.appliedCount, 0);
  const upToDate = statuses.filter((s) => s.pendingCount === 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <GitBranch className="h-6 w-6 text-blue-600" />
            </div>
            Database Migrations
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage incremental schema migrations and seed data across all tenant databases
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchStatus} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={isSyncingAll || isLoading}
            className="text-blue-600 border-blue-300 hover:bg-blue-50"
          >
            {isSyncingAll ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4 mr-2" />
            )}
            Sync Permissions
          </Button>
          <Button
            size="sm"
            onClick={handleRunAll}
            disabled={isRunningAll || isLoading || totalPending === 0}
          >
            {isRunningAll ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run All Pending
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-full bg-blue-500/10">
              <Database className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Tenants</p>
              <p className="text-2xl font-bold">{statuses.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-full bg-green-500/10">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Up to Date</p>
              <p className="text-2xl font-bold">{upToDate}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-full bg-amber-500/10">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Migrations</p>
              <p className="text-2xl font-bold">{totalPending}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-full bg-purple-500/10">
              <GitBranch className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Applied</p>
              <p className="text-2xl font-bold">{totalApplied}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Migrations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Tenant Migration Status
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : statuses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Database className="h-12 w-12 mb-4 opacity-30" />
              <p>No tenant databases found</p>
            </div>
          ) : (
            <div className="divide-y">
              {/* Table Header */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <span>Database</span>
                <span>Total Files</span>
                <span>Applied</span>
                <span>Pending</span>
                <span>Status</span>
                <span>Actions</span>
              </div>

              {statuses.map((status) => {
                const isExpanded = expandedRows.has(status.database);
                const isRunningThis = runningTenant === status.database;
                const tenantSlug = status.database.replace(/^tenant_/, '').replace(/_/g, '-');

                return (
                  <div key={status.database}>
                    {/* Row */}
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center px-6 py-4 hover:bg-gray-50 transition-colors">
                      {/* Database Name */}
                      <div className="flex items-center gap-2">
                        <button
                          className="flex items-center gap-2 text-left"
                          onClick={() => status.pendingCount > 0 && toggleExpand(status.database)}
                        >
                          {status.pendingCount > 0 ? (
                            isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                            )
                          ) : (
                            <div className="w-4" />
                          )}
                          <div>
                            <p className="font-mono text-sm font-medium text-gray-900">
                              {status.database}
                            </p>
                            <p className="text-xs text-gray-500">{tenantSlug}</p>
                          </div>
                        </button>
                      </div>

                      {/* Total Files */}
                      <span className="text-sm text-gray-700">{status.totalFiles}</span>

                      {/* Applied */}
                      <span className="text-sm text-green-700 font-medium">{status.appliedCount}</span>

                      {/* Pending */}
                      <span className={`text-sm font-medium ${status.pendingCount > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {status.pendingCount}
                      </span>

                      {/* Status Badge */}
                      <div>
                        {status.pending[0]?.startsWith('[ERROR]') ? (
                          <Badge variant="destructive">Error</Badge>
                        ) : status.pendingCount === 0 ? (
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-700 border-green-200"
                          >
                            ✓ Up to date
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-amber-100 text-amber-700 border-amber-200"
                          >
                            {status.pendingCount} Pending
                          </Badge>
                        )}
                      </div>

                      {/* Run Button */}
                      <Button
                        size="sm"
                        variant={status.pendingCount > 0 ? 'default' : 'outline'}
                        disabled={isRunningThis || isRunningAll || status.pendingCount === 0}
                        onClick={() => handleRunTenant(tenantSlug)}
                        className="min-w-[80px]"
                      >
                        {isRunningThis ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : status.pendingCount > 0 ? (
                          <>
                            <Play className="h-3 w-3 mr-1" />
                            Run
                          </>
                        ) : (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        )}
                      </Button>
                    </div>

                    {/* Expanded: Pending file list */}
                    {isExpanded && status.pendingCount > 0 && (
                      <div className="px-14 pb-4 bg-amber-50/50 border-t border-amber-100">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide py-2">
                          Pending Migrations
                        </p>
                        <div className="space-y-1">
                          {status.pending.map((file) => (
                            <div
                              key={file}
                              className="flex items-center gap-2 text-xs font-mono text-amber-800 bg-amber-100/60 rounded px-3 py-1.5"
                            >
                              <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                              {file}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info box */}
      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <GitBranch className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800 space-y-1">
              <p className="font-medium">How incremental migrations work</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700 text-xs">
                <li>SQL files in <code className="bg-blue-100 px-1 rounded">src/migrations/tenant/</code> are sorted alphabetically and applied in order</li>
                <li>A <code className="bg-blue-100 px-1 rounded">schema_migrations</code> table in each tenant DB tracks applied files — already-applied migrations are never re-run</li>
                <li>Files with <code className="bg-blue-100 px-1 rounded">seed</code> in their name soft-fail on conflict (data); all other files hard-fail (schema must succeed)</li>
                <li>On-boot sweep automatically migrates all tenants 2 seconds after server startup</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
