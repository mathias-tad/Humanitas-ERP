import { describe, expect, it } from 'vitest';
import { contactLabel, tinProblem } from './useContacts';
import { getEntity } from '@/components/platform/entityRegistry';
import '@/components/contacts/registerContactEntities';

describe('contacts', () => {
  it('checks an Ethiopian TIN as it is typed', () => {
    expect(tinProblem('')).toBeNull();
    expect(tinProblem('0012 345 678')).toBeNull();
    expect(tinProblem('0012-345-678')).toBeNull();
    expect(tinProblem('12345')).toBe('A TIN is 10 digits');
  });

  it('names a person with their company', () => {
    expect(contactLabel({ name: 'Sara', parent_name: 'Abebe Trading' })).toBe('Sara · Abebe Trading');
    expect(contactLabel({ name: 'Abebe Trading', parent_name: null })).toBe('Abebe Trading');
  });

  it('registers contacts, customers and companies for pickers and Ctrl+K, under the contacts module family', () => {
    for (const type of ['contact', 'customer', 'contact_company']) {
      const def = getEntity(type);
      expect(def?.module).toBe('contacts');
      expect(def?.permissions).toEqual({ view: 'view_contacts', create: 'create_contacts' });
    }
    // Only the general contact type opens the form, so Ctrl+K lists each contact once.
    expect(getEntity('contact')?.Form).toBeTruthy();
    expect(getEntity('customer')?.Form).toBeUndefined();
    expect(getEntity('contact')?.toOption({ id: 'c1', name: 'Sara', parent_name: 'Abebe Trading', code: 'C000002', contact_type: 'person', job_title: 'Buyer', phone: '0911234567', tin: null } as never))
      .toEqual({ id: 'c1', label: 'Sara · Abebe Trading', description: 'C000002 · Buyer · 0911234567' });
  });
});
