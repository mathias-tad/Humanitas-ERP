/**
 * Contacts permissions: one per action per resource (AGENTS.md rule 27).
 * Registered in roles.service.ts (role defaults + migration for existing tenants) and roles/permission-catalog.ts.
 */
export const CONTACT_PERMISSIONS = {
  view: 'view_contacts',
  create: 'create_contacts',
  edit: 'edit_contacts',
  delete: 'delete_contacts',
  restore: 'restore_contacts',
  export: 'export_contacts',
} as const;

export const CONTACT_CATEGORY_PERMISSIONS = {
  view: 'view_contact_categories',
  create: 'create_contact_categories',
  edit: 'edit_contact_categories',
  delete: 'delete_contact_categories',
} as const;

const values = <T extends Record<string, string>>(o: T) => Object.values(o) as T[keyof T][];

export const ALL_CONTACTS_PERMISSIONS: string[] = [...values(CONTACT_PERMISSIONS), ...values(CONTACT_CATEGORY_PERMISSIONS)];

/** Destructive actions kept for Administrators by default. */
export const CONTACTS_ADMIN_ONLY_PERMISSIONS: string[] = [
  CONTACT_PERMISSIONS.delete,
  CONTACT_PERMISSIONS.restore,
  CONTACT_CATEGORY_PERMISSIONS.delete,
];

export const CONTACTS_MANAGER_PERMISSIONS: string[] = ALL_CONTACTS_PERMISSIONS.filter(
  (p) => !CONTACTS_ADMIN_ONLY_PERMISSIONS.includes(p),
);

/** Employees (sales staff, cashiers, buyers) look contacts up. */
export const CONTACTS_EMPLOYEE_PERMISSIONS: string[] = [CONTACT_PERMISSIONS.view, CONTACT_CATEGORY_PERMISSIONS.view];
