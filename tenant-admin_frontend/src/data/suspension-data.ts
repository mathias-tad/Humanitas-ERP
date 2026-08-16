import type { SuspensionRecord } from '@/types/tenant';

export const mockSuspensionHistory: Record<string, SuspensionRecord[]> = {
  '550e8400-e29b-41d4-a716-446655440005': [
    {
      id: 'susp-001',
      tenant_id: '550e8400-e29b-41d4-a716-446655440005',
      action: 'suspended',
      reason: 'non_payment',
      notes: 'Invoice overdue by 45 days. Multiple reminders sent.',
      performed_by: 'Super Admin',
      performed_at: '2024-07-01T00:00:00Z',
    },
  ],
};

export const suspensionReasonLabels: Record<string, string> = {
  policy_violation: 'Policy Violation',
  security_concern: 'Security Concern',
  abuse_detected: 'Abuse Detected',
  legal_compliance: 'Legal/Compliance Issue',
  customer_request: 'Customer Request',
  non_payment: 'Non-Payment',
  payment_failed: 'Payment Failed (Auto)',
  maintenance: 'Maintenance/Investigation',
  other: 'Other',
};
