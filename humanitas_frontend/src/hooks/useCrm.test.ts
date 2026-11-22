import { describe, expect, it } from 'vitest';
import { activityState, formatMoney, isOverdue, leadWho, monthLabel, toLocalInput } from './useCrm';
import { emptyLeadForm, leadFormToInput, validateLeadForm } from '@/components/crm/LeadForm';
import { emptyDealForm, validateDealForm } from '@/components/crm/OpportunityForm';

describe('CRM helpers', () => {
  it('formats money, months and who a lead is', () => {
    expect(formatMoney('12500.5')).toBe('12,500.50');
    expect(formatMoney(null)).toBe('0.00');
    expect(monthLabel('2026-11')).toBe('Nov 2026');
    expect(monthLabel('none')).toBe('No close date');
    expect(leadWho({ person_name: 'Sara', company_name: 'Abebe Trading' })).toBe('Sara · Abebe Trading');
    expect(leadWho({ person_name: null, company_name: null })).toBe('—');
  });

  it('knows overdue deals and where an activity falls', () => {
    expect(isOverdue({ status: 'open', expected_close_date: '2026-11-01' }, '2026-11-22')).toBe(true);
    expect(isOverdue({ status: 'won', expected_close_date: '2026-11-01' }, '2026-11-22')).toBe(false);
    expect(isOverdue({ status: 'open', expected_close_date: null }, '2026-11-22')).toBe(false);
    const now = new Date(2026, 10, 22, 12, 0);
    expect(activityState({ due_at: new Date(2026, 10, 22, 9, 0).toISOString(), done_at: null }, now)).toBe('overdue');
    expect(activityState({ due_at: new Date(2026, 10, 22, 15, 0).toISOString(), done_at: null }, now)).toBe('today');
    expect(activityState({ due_at: new Date(2026, 10, 25, 9, 0).toISOString(), done_at: null }, now)).toBe('upcoming');
    expect(activityState({ due_at: new Date(2026, 10, 20).toISOString(), done_at: '2026-11-21T08:00:00Z' }, now)).toBe('done');
    expect(toLocalInput(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05T09:07');
  });
});

describe('lead and deal forms', () => {
  it('needs what they want and who, and checks numbers and email', () => {
    expect(Object.keys(validateLeadForm(emptyLeadForm())).sort()).toEqual(['person_name', 'title']);
    const f = { ...emptyLeadForm({ name: 'Chairs' }), company_name: 'Abebe Trading', email: 'bad', budget: '-1' };
    expect(Object.keys(validateLeadForm(f)).sort()).toEqual(['budget', 'email']);
    const ok = { ...emptyLeadForm({ title: ' Chairs ' }, 'u1'), person_name: ' Sara ', budget: '5000', phone: ' ' };
    expect(validateLeadForm(ok)).toEqual({});
    expect(leadFormToInput(ok)).toMatchObject({ title: 'Chairs', person_name: 'Sara', budget: 5000, phone: null, owner_id: 'u1', expected_revenue: null });
  });

  it('checks a deal name and probability', () => {
    expect(Object.keys(validateDealForm({ ...emptyDealForm(), probability: '120' })).sort()).toEqual(['name', 'probability']);
    expect(validateDealForm({ ...emptyDealForm({ name: 'Chairs' }), probability: '40', expected_revenue: '20000' })).toEqual({});
  });
});
