/**
 * CRM permissions: one per action per resource (AGENTS.md rule 27).
 * Registered in roles.service.ts (role defaults + migration for existing tenants) and roles/permission-catalog.ts.
 */
export const LEAD_PERMISSIONS = {
  view: 'view_crm_leads',
  create: 'create_crm_leads',
  edit: 'edit_crm_leads',
  delete: 'delete_crm_leads',
  restore: 'restore_crm_leads',
  export: 'export_crm_leads',
} as const;

export const OPPORTUNITY_PERMISSIONS = {
  view: 'view_crm_opportunities',
  create: 'create_crm_opportunities',
  edit: 'edit_crm_opportunities',
  delete: 'delete_crm_opportunities',
  restore: 'restore_crm_opportunities',
  export: 'export_crm_opportunities',
} as const;

export const ACTIVITY_PERMISSIONS = {
  view: 'view_crm_activities',
  create: 'create_crm_activities',
  edit: 'edit_crm_activities',
  delete: 'delete_crm_activities',
} as const;

/** Pipelines and stages, lead sources and lost reasons. */
export const CRM_SETUP_PERMISSIONS = {
  view: 'view_crm_setup',
  create: 'create_crm_setup',
  edit: 'edit_crm_setup',
  delete: 'delete_crm_setup',
} as const;

const values = <T extends Record<string, string>>(o: T) => Object.values(o) as T[keyof T][];

export const ALL_CRM_PERMISSIONS: string[] = [
  ...values(LEAD_PERMISSIONS), ...values(OPPORTUNITY_PERMISSIONS), ...values(ACTIVITY_PERMISSIONS), ...values(CRM_SETUP_PERMISSIONS),
];

/** Destructive and set-up actions kept for Administrators by default. */
export const CRM_ADMIN_ONLY_PERMISSIONS: string[] = [
  LEAD_PERMISSIONS.delete, LEAD_PERMISSIONS.restore, OPPORTUNITY_PERMISSIONS.delete, OPPORTUNITY_PERMISSIONS.restore,
  CRM_SETUP_PERMISSIONS.create, CRM_SETUP_PERMISSIONS.edit, CRM_SETUP_PERMISSIONS.delete,
];

export const CRM_MANAGER_PERMISSIONS: string[] = ALL_CRM_PERMISSIONS.filter((p) => !CRM_ADMIN_ONLY_PERMISSIONS.includes(p));

/** Sales staff work their own leads, deals and activities. */
export const CRM_EMPLOYEE_PERMISSIONS: string[] = [
  LEAD_PERMISSIONS.view, LEAD_PERMISSIONS.create, LEAD_PERMISSIONS.edit,
  OPPORTUNITY_PERMISSIONS.view, OPPORTUNITY_PERMISSIONS.create, OPPORTUNITY_PERMISSIONS.edit,
  ACTIVITY_PERMISSIONS.view, ACTIVITY_PERMISSIONS.create, ACTIVITY_PERMISSIONS.edit,
  CRM_SETUP_PERMISSIONS.view,
];
