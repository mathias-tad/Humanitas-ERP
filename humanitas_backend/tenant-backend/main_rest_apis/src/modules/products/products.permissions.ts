/**
 * Products & Catalog permissions — one permission per action per resource (AGENTS.md rule 27).
 * Registered in roles.service.ts (role defaults + migration for existing tenants).
 */
export const PRODUCT_PERMISSIONS = {
  view: 'view_products',
  create: 'create_products',
  edit: 'edit_products',
  delete: 'delete_products',
  restore: 'restore_products',
  export: 'export_products',
} as const;

export const PRODUCT_CATEGORY_PERMISSIONS = {
  view: 'view_product_categories',
  create: 'create_product_categories',
  edit: 'edit_product_categories',
  delete: 'delete_product_categories',
} as const;

export const UOM_PERMISSIONS = {
  view: 'view_uoms',
  create: 'create_uoms',
  edit: 'edit_uoms',
  delete: 'delete_uoms',
} as const;

export const PRODUCT_ATTRIBUTE_PERMISSIONS = {
  view: 'view_product_attributes',
  create: 'create_product_attributes',
  edit: 'edit_product_attributes',
  delete: 'delete_product_attributes',
} as const;

export const PRICE_LIST_PERMISSIONS = {
  view: 'view_price_lists',
  create: 'create_price_lists',
  edit: 'edit_price_lists',
  delete: 'delete_price_lists',
  export: 'export_price_lists',
} as const;

const values = <T extends Record<string, string>>(o: T) => Object.values(o) as T[keyof T][];

/** Every Products permission. */
export const ALL_PRODUCTS_PERMISSIONS: string[] = [
  ...values(PRODUCT_PERMISSIONS),
  ...values(PRODUCT_CATEGORY_PERMISSIONS),
  ...values(UOM_PERMISSIONS),
  ...values(PRODUCT_ATTRIBUTE_PERMISSIONS),
  ...values(PRICE_LIST_PERMISSIONS),
];

/** Destructive or configuration actions kept for Administrators by default. */
export const PRODUCTS_ADMIN_ONLY_PERMISSIONS: string[] = [
  PRODUCT_PERMISSIONS.delete,
  PRODUCT_PERMISSIONS.restore,
  PRODUCT_CATEGORY_PERMISSIONS.delete,
  UOM_PERMISSIONS.create,
  UOM_PERMISSIONS.edit,
  UOM_PERMISSIONS.delete,
  PRODUCT_ATTRIBUTE_PERMISSIONS.delete,
  PRICE_LIST_PERMISSIONS.delete,
];

/** Managers: everything except the admin-only list. */
export const PRODUCTS_MANAGER_PERMISSIONS: string[] = ALL_PRODUCTS_PERMISSIONS.filter(
  (p) => !PRODUCTS_ADMIN_ONLY_PERMISSIONS.includes(p),
);

/** Employees (e.g. cashiers, sales staff) can look products up. */
export const PRODUCTS_EMPLOYEE_PERMISSIONS: string[] = [
  PRODUCT_PERMISSIONS.view,
  PRODUCT_CATEGORY_PERMISSIONS.view,
  UOM_PERMISSIONS.view,
  PRODUCT_ATTRIBUTE_PERMISSIONS.view,
  PRICE_LIST_PERMISSIONS.view,
];
