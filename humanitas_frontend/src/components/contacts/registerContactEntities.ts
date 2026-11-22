import { api } from '@/lib/api';
import { registerEntity } from '@/components/platform/entityRegistry';
import { contactLabel, searchContacts, type Contact } from '@/hooks/useContacts';
import { ContactForm } from './ContactForm';

const describe = (c: Contact) =>
  [c.code, c.contact_type === 'person' ? c.job_title : null, c.phone ?? c.mobile, c.tin ? `TIN ${c.tin}` : null].filter(Boolean).join(' · ');

/**
 * Contacts register once (featureslist §29): every module gets contact, customer and company search,
 * one-step create and "Create & edit…", and Ctrl+K finds contacts.
 */
registerEntity<Contact>({
  type: 'contact',
  label: 'contact',
  module: 'contacts',
  permissions: { view: 'view_contacts', create: 'create_contacts' },
  search: (q) => searchContacts(q),
  toOption: (c) => ({ id: c.id, label: contactLabel(c), description: describe(c) }),
  quickCreate: (name) => api.post<Contact>('/contacts', { name }),
  Form: ContactForm,
});

/** Customer pickers (Sales, POS, invoices): contacts with the Customer role; quick create makes a customer. */
registerEntity<Contact>({
  type: 'customer',
  label: 'customer',
  module: 'contacts',
  permissions: { view: 'view_contacts', create: 'create_contacts' },
  search: (q) => searchContacts(q, { role: 'customer' }),
  toOption: (c) => ({ id: c.id, label: contactLabel(c), description: describe(c) }),
  quickCreate: (name) => api.post<Contact>('/contacts', { name, is_customer: true }),
});

/** "Works at" picker for a person: companies only. */
registerEntity<Contact>({
  type: 'contact_company',
  label: 'company',
  module: 'contacts',
  permissions: { view: 'view_contacts', create: 'create_contacts' },
  search: (q) => searchContacts(q, { contact_type: 'company' }),
  toOption: (c) => ({ id: c.id, label: c.name, description: describe(c) }),
  quickCreate: (name) => api.post<Contact>('/contacts', { name, contact_type: 'company' }),
});
