import { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  TrendingUp,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import type { Tenant } from '@/types/tenant';

interface TenantStats {
  total: number;
  active: number;
  trial: number;
  suspended: number;
  by_plan: { plan: string; count: number }[];
}

const colorClasses = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  purple: 'bg-purple-100 text-purple-600',
  orange: 'bg-orange-100 text-orange-600',
};

export default function Dashboard() {
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [recentTenants, setRecentTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [statsRes, tenantsRes] = await Promise.all([
          api.get<TenantStats>('/tenants/stats'),
          api.get<{ data: Tenant[] }>('/tenants', { params: { limit: '5' } }),
        ]);
        setStats(statsRes);
        setRecentTenants(tenantsRes.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg flex items-center gap-2">
        <AlertCircle className="h-5 w-5" />
        {error}
      </div>
    );
  }

  const statCards = [
    {
      name: 'Total Tenants',
      value: stats?.total || 0,
      icon: Building2,
      color: 'blue',
    },
    {
      name: 'Active Tenants',
      value: stats?.active || 0,
      icon: TrendingUp,
      color: 'green',
    },
    {
      name: 'Trial Tenants',
      value: stats?.trial || 0,
      icon: Users,
      color: 'purple',
    },
    {
      name: 'Suspended',
      value: stats?.suspended || 0,
      icon: AlertCircle,
      color: 'orange',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your SaaS platform</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div
                  className={`p-2 rounded-lg ${
                    colorClasses[stat.color as keyof typeof colorClasses]
                  }`}
                >
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.name}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plans breakdown */}
      {stats?.by_plan && stats.by_plan.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tenants by Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {stats.by_plan.map((item) => (
                <div key={item.plan} className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {item.plan}
                  </Badge>
                  <span className="font-semibold">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Tenants */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Recent Tenants</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentTenants.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No tenants yet. Create your first tenant to get started.
            </div>
          ) : (
            <div className="divide-y">
              {recentTenants.map((tenant) => (
                <div key={tenant.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{tenant.company_name}</p>
                      <p className="text-sm text-gray-500">{tenant.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {tenant.current_users} / {tenant.max_users} users
                      </p>
                      <p className="text-xs text-gray-500">{tenant.subscription_plan}</p>
                    </div>
                    <Badge
                      variant={
                        tenant.subscription_status === 'active'
                          ? 'success'
                          : tenant.subscription_status === 'trial'
                          ? 'warning'
                          : 'destructive'
                      }
                    >
                      {tenant.subscription_status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
