import { ConflictException } from '@nestjs/common';

/** Map PostgreSQL unique violations on catalog tables to clear 409 messages. */
const MESSAGES: Record<string, string> = {
  uq_products_sku: 'A product with this SKU already exists',
  uq_products_item_code: 'A product with this item code already exists',
  uq_product_barcodes_barcode: 'This barcode is already used by another product',
  uq_product_barcodes_one_primary: 'A product can have only one primary barcode',
  uq_product_categories_sibling_name: 'A category with this name already exists at this level',
  uq_product_categories_code: 'A category with this code already exists',
  uq_uom_categories_name: 'A unit category with this name already exists',
  uq_uoms_category_name: 'A unit with this name already exists in this category',
  uq_uoms_one_reference: 'This unit category already has a reference unit',
};

export function rethrowCatalogConflict(err: unknown): never {
  const e = err as { code?: string; constraint?: string; driverError?: { code?: string; constraint?: string } };
  const code = e?.code ?? e?.driverError?.code;
  const constraint = e?.constraint ?? e?.driverError?.constraint;
  if (code === '23505' && constraint && MESSAGES[constraint]) throw new ConflictException(MESSAGES[constraint]);
  throw err;
}
