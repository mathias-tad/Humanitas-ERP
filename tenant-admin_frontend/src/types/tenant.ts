export interface Tenant {
  id: string;
  company_name: string;
  slug: string;
  database_name: string;
  contact_email: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  subscription_status: 'trial' | 'active' | 'suspended' | 'canceled';
  subscription_plan: 'basic' | 'professional' | 'enterprise';
  subscription_started_at?: string;
  subscription_ends_at?: string;
  trial_ends_at?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  monthly_fee?: number;
  per_user_fee?: number;
  max_users: number;
  current_users: number;
  max_devices: number;
  current_devices: number;
  storage_limit_gb: number;
  storage_used_gb: number;
  enabled_features: string[];
  timezone: string;
  date_format: string;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantAdmin {
  id: string;
  tenant_id: string;
  email: string;
  full_name?: string;
  phone?: string;
  email_verified: boolean;
  two_factor_enabled: boolean;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
}

export interface SubscriptionPlan {
  id: number;
  plan_code: string;
  plan_name: string;
  description?: string;
  base_price: number;
  per_user_price?: number;
  billing_interval: 'monthly' | 'yearly';
  max_users?: number;
  max_devices?: number;
  storage_gb?: number;
  features: string[];
  is_active: boolean;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  invoice_number: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  billing_period_start: string;
  billing_period_end: string;
  user_count: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  paid_at?: string;
  due_date: string;
  created_at: string;
}

export interface TenantStats {
  total_tenants: number;
  active_tenants: number;
  trial_tenants: number;
  suspended_tenants: number;
  total_users: number;
  total_revenue: number;
  mrr: number;
}

export interface SuspensionRecord {
  id: string;
  tenant_id: string;
  action: 'suspended' | 'reactivated';
  reason?: string;
  notes?: string;
  performed_by: string;
  performed_at: string;
}

export type SuspensionReason = 
  | 'policy_violation'
  | 'security_concern'
  | 'abuse_detected'
  | 'legal_compliance'
  | 'customer_request'
  | 'non_payment'
  | 'maintenance'
  | 'other';
