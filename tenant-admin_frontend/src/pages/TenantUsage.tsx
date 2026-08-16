import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart3, Zap, TrendingUp, AlertTriangle, Loader2, RefreshCw, ChevronDown, ChevronRight, Search, Filter, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';

interface TenantUsageSummary {
  tenant_id: string;
  tenant_name?: string;
  total_tokens_used: number;
  total_cost_usd: number;
  total_requests: number;
  token_limit: number;
  usage_percent: number;
  feature_breakdown: Record<string, number>;
}

interface PlatformSummary {
  total_tenants_with_usage: number;
  total_tokens_used: number;
  total_cost_usd: number;
  total_requests: number;
  tenants: TenantUsageSummary[];
}

const FEATURE_LABELS: Record<string, string> = {
  attrition: 'Attrition Analysis',
  onboarding: 'Onboarding Assist',
  conversation: 'Chat Conversations',
  document: 'Document Generation',
  recruitment: 'Recruitment AI',
  performance: 'Performance Review',
};

function UsageBar({ percent }: { percent: number }) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const color = clamped >= 90 ? 'bg-red-500' : clamped >= 70 ? 'bg-amber-500' : 'bg-blue-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-gray-100">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-600 w-10 text-right">{clamped.toFixed(0)}%</span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'blue' }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-lg ${colorMap[color] ?? colorMap.blue}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TenantUsage() {
  const [data, setData] = useState<PlatformSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('tokens_desc');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.get<PlatformSummary>('/ai/usage');
      setData(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load usage data';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleExpand = (id: string) => setExpanded(prev => prev === id ? null : id);

  const filteredTenants = useMemo(() => {
    if (!data?.tenants) return [];

    return data.tenants
      .filter(tenant => {
        // 1. Search Query
        const query = searchQuery.trim().toLowerCase();
        const matchesSearch = !query ||
          (tenant.tenant_name && tenant.tenant_name.toLowerCase().includes(query)) ||
          tenant.tenant_id.toLowerCase().includes(query);

        if (!matchesSearch) return false;

        // 2. Status Filter
        const usagePercent = tenant.usage_percent ?? 0;
        if (statusFilter === 'normal' && usagePercent >= 70) return false;
        if (statusFilter === 'high' && (usagePercent < 70 || usagePercent >= 90)) return false;
        if (statusFilter === 'near_limit' && usagePercent < 90) return false;

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'tokens_desc':
            return Number(b.total_tokens_used) - Number(a.total_tokens_used);
          case 'tokens_asc':
            return Number(a.total_tokens_used) - Number(b.total_tokens_used);
          case 'requests_desc':
            return Number(b.total_requests) - Number(a.total_requests);
          case 'cost_desc':
            return Number(b.total_cost_usd) - Number(a.total_cost_usd);
          case 'name_asc':
            const nameA = a.tenant_name || a.tenant_id;
            const nameB = b.tenant_name || b.tenant_id;
            return nameA.localeCompare(nameB);
          default:
            return 0;
        }
      });
  }, [data?.tenants, searchQuery, statusFilter, sortBy]);

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || sortBy !== 'tokens_desc';

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSortBy('tokens_desc');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Usage</h1>
          <p className="text-gray-500 mt-1">Monitor AI token consumption across all tenants</p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-48 text-center">
            <BarChart3 className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-500">No usage data available yet</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={BarChart3}
              label="Tenants Using AI"
              value={String(data.total_tenants_with_usage ?? 0)}
              color="blue"
            />
            <StatCard
              icon={Zap}
              label="Total Tokens Used"
              value={Number(data.total_tokens_used ?? 0).toLocaleString()}
              color="amber"
            />
            <StatCard
              icon={TrendingUp}
              label="Total AI Requests"
              value={Number(data.total_requests ?? 0).toLocaleString()}
              color="green"
            />
            <StatCard
              icon={AlertTriangle}
              label="Total Cost (USD)"
              value={`$${Number(data.total_cost_usd ?? 0).toFixed(4)}`}
              color="purple"
            />
          </div>

          {/* Per-Tenant Table Card */}
          <Card>
            <CardHeader className="border-b pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Usage Per Tenant</CardTitle>
                  <CardDescription>Click a row to see feature breakdown</CardDescription>
                </div>

                {/* Filter Controls Bar */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Search Input */}
                  <div className="relative min-w-[180px] sm:min-w-[220px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Search tenant name or ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Status Filter */}
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px] h-9 text-sm">
                      <div className="flex items-center gap-1.5 truncate">
                        <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <SelectValue placeholder="Status" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="normal">Normal (&lt;70%)</SelectItem>
                      <SelectItem value="high">High (70-89%)</SelectItem>
                      <SelectItem value="near_limit">Near Limit (&ge;90%)</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Sort By */}
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[150px] h-9 text-sm">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tokens_desc">Tokens (High to Low)</SelectItem>
                      <SelectItem value="tokens_asc">Tokens (Low to High)</SelectItem>
                      <SelectItem value="requests_desc">Requests (High to Low)</SelectItem>
                      <SelectItem value="cost_desc">Cost (High to Low)</SelectItem>
                      <SelectItem value="name_asc">Tenant Name (A-Z)</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Reset Filters */}
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetFilters}
                      className="h-9 px-2.5 text-xs text-gray-500 hover:text-gray-900"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Reset
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {(!data.tenants || data.tenants.length === 0) ? (
                <div className="text-center py-12 text-gray-400">
                  <Zap className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                  <p>No tenant usage logged yet.</p>
                  <p className="text-sm mt-1">Usage will appear here once tenants start using the AI assistant.</p>
                </div>
              ) : filteredTenants.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Search className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                  <p className="font-medium text-gray-600">No matching tenants found</p>
                  <p className="text-sm mt-1 text-gray-400">Try adjusting your search or status filter</p>
                  <Button variant="link" onClick={resetFilters} className="mt-2 text-blue-600 text-sm">
                    Clear all filters
                  </Button>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-6"></TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Tokens Used</TableHead>
                        <TableHead>Requests</TableHead>
                        <TableHead>Cost (USD)</TableHead>
                        <TableHead>Budget Usage</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTenants.map(tenant => {
                        const isExpanded = expanded === tenant.tenant_id;
                        const usagePercent = tenant.usage_percent ?? 0;
                        return (
                          <>
                            <TableRow
                              key={tenant.tenant_id}
                              className="cursor-pointer hover:bg-gray-50"
                              onClick={() => toggleExpand(tenant.tenant_id)}
                            >
                              <TableCell>
                                {isExpanded
                                  ? <ChevronDown className="w-4 h-4 text-gray-400" />
                                  : <ChevronRight className="w-4 h-4 text-gray-400" />}
                              </TableCell>
                              <TableCell>
                                <p className="font-medium text-gray-900">
                                  {tenant.tenant_name || tenant.tenant_id}
                                </p>
                                <p className="text-xs text-gray-400 font-mono">{tenant.tenant_id.slice(0, 8)}…</p>
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {Number(tenant.total_tokens_used).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-sm">
                                {Number(tenant.total_requests).toLocaleString()}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                ${Number(tenant.total_cost_usd).toFixed(4)}
                              </TableCell>
                              <TableCell className="min-w-[140px]">
                                <UsageBar percent={usagePercent} />
                              </TableCell>
                              <TableCell>
                                {usagePercent >= 90 ? (
                                  <Badge variant="destructive">Near Limit</Badge>
                                ) : usagePercent >= 70 ? (
                                  <Badge className="bg-amber-100 text-amber-700">High</Badge>
                                ) : (
                                  <Badge variant="secondary">Normal</Badge>
                                )}
                              </TableCell>
                            </TableRow>

                            {/* Feature breakdown expansion */}
                            {isExpanded && (
                              <TableRow key={`${tenant.tenant_id}-expanded`} className="bg-gray-50">
                                <TableCell colSpan={7} className="py-3 px-6">
                                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                                    Feature Breakdown
                                  </p>
                                  {tenant.feature_breakdown && Object.keys(tenant.feature_breakdown).length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                      {Object.entries(tenant.feature_breakdown).map(([feature, tokens]) => (
                                        <div key={feature} className="bg-white border rounded-lg px-3 py-2">
                                          <p className="text-xs text-gray-500">
                                            {FEATURE_LABELS[feature] ?? feature}
                                          </p>
                                          <p className="text-sm font-semibold text-gray-800 mt-0.5">
                                            {Number(tokens).toLocaleString()} tokens
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-400">No feature breakdown available</p>
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {hasActiveFilters && (
                    <div className="px-6 py-2.5 border-t bg-gray-50/50 text-xs text-gray-500">
                      Showing {filteredTenants.length} of {data.tenants.length} tenants
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
