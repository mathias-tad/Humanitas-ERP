import { Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { mockPlans } from '@/data/mock-data';

const featureLabels: Record<string, string> = {
  pms: 'Project Management',
  attendance: 'Attendance Tracking',
  leave: 'Leave Management',
  payroll: 'Payroll Processing',
  reports: 'Advanced Reports',
  advanced_analytics: 'Analytics Dashboard',
};

export default function Subscriptions() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscription Plans</h1>
        <p className="text-gray-500 mt-1">Manage your SaaS subscription tiers and pricing</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {mockPlans.map((plan) => (
          <Card key={plan.id} className={plan.plan_code === 'professional' ? 'ring-2 ring-blue-600' : ''}>
            {plan.plan_code === 'professional' && (
              <div className="bg-blue-600 text-white text-center py-1 text-sm font-medium">
                Most Popular
              </div>
            )}
            <CardHeader>
              <CardTitle>{plan.plan_name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <span className="text-4xl font-bold">${plan.base_price}</span>
                <span className="text-gray-500">/month</span>
                {plan.per_user_price && (
                  <p className="text-sm text-gray-500 mt-1">+ ${plan.per_user_price}/user</p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Max Users</span>
                  <Badge variant="secondary">
                    {plan.max_users === 999999 ? 'Unlimited' : plan.max_users}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Max Devices</span>
                  <Badge variant="secondary">{plan.max_devices}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Storage</span>
                  <Badge variant="secondary">{plan.storage_gb} GB</Badge>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Features</p>
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                      <Check className="h-4 w-4 text-green-600" />
                      {featureLabels[feature] || feature}
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                className="w-full"
                variant={plan.plan_code === 'professional' ? 'default' : 'outline'}
                style={plan.plan_code === 'professional' ? { backgroundColor: '#2563eb' } : {}}
              >
                Edit Plan
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-3xl font-bold text-gray-900">45</p>
              <p className="text-sm text-gray-500">Basic Plans</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-3xl font-bold text-blue-600">78</p>
              <p className="text-sm text-gray-500">Professional Plans</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-3xl font-bold text-purple-600">33</p>
              <p className="text-sm text-gray-500">Enterprise Plans</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
