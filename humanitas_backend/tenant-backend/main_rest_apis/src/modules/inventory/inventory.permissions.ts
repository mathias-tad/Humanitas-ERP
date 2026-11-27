/**
 * Inventory permissions — one permission per action per resource (AGENTS.md rule 27).
 * Registered in roles.service.ts (role defaults + migration for existing tenants) and
 * permission-catalog.ts (the Access Control page). Only what is built is listed: stocktakes, lots,
 * reorder points and reports add their permissions with their screens, so Access Control never
 * offers a permission for something that does not exist yet.
 */
export const WAREHOUSE_PERMISSIONS = {
  view: 'view_warehouses',
  create: 'create_warehouses',
  edit: 'edit_warehouses',
  delete: 'delete_warehouses',
} as const;

export const LOCATION_PERMISSIONS = {
  view: 'view_inventory_locations',
  create: 'create_inventory_locations',
  edit: 'edit_inventory_locations',
  delete: 'delete_inventory_locations',
} as const;

export const STOCK_PERMISSIONS = {
  view: 'view_stock',
  adjust: 'adjust_stock',
  export: 'export_stock',
  /** Cost and valuation figures; a picker who may see quantities need not see money. */
  viewValuation: 'view_stock_valuation',
} as const;

export const TRANSFER_PERMISSIONS = {
  view: 'view_transfers',
  create: 'create_transfers',
  edit: 'edit_transfers',
  delete: 'delete_transfers',
  /** Mark done: the step that actually moves stock and consumes valuation layers. */
  validate: 'validate_transfers',
  cancel: 'cancel_transfers',
  export: 'export_transfers',
} as const;

const values = <T extends Record<string, string>>(o: T) => Object.values(o) as T[keyof T][];

/** Every Inventory permission. */
export const ALL_INVENTORY_PERMISSIONS: string[] = [
  ...values(WAREHOUSE_PERMISSIONS),
  ...values(LOCATION_PERMISSIONS),
  ...values(STOCK_PERMISSIONS),
  ...values(TRANSFER_PERMISSIONS),
];

/** Destructive or stock-moving actions kept for Administrators by default. */
export const INVENTORY_ADMIN_ONLY_PERMISSIONS: string[] = [
  WAREHOUSE_PERMISSIONS.delete,
  LOCATION_PERMISSIONS.delete,
  STOCK_PERMISSIONS.adjust,
  TRANSFER_PERMISSIONS.delete,
];

/** Managers: everything except the admin-only list. They run the warehouse day to day. */
export const INVENTORY_MANAGER_PERMISSIONS: string[] = ALL_INVENTORY_PERMISSIONS.filter(
  (p) => !INVENTORY_ADMIN_ONLY_PERMISSIONS.includes(p),
);

/** Employees (storekeepers, pickers) look stock up and receive, deliver and move it. No money, no set-up changes. */
export const INVENTORY_EMPLOYEE_PERMISSIONS: string[] = [
  WAREHOUSE_PERMISSIONS.view,
  LOCATION_PERMISSIONS.view,
  STOCK_PERMISSIONS.view,
  TRANSFER_PERMISSIONS.view,
  TRANSFER_PERMISSIONS.create,
  TRANSFER_PERMISSIONS.edit,
  TRANSFER_PERMISSIONS.validate,
];
