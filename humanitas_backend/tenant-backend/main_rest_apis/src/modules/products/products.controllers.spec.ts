import 'reflect-metadata';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { MODULE_KEY } from '../auth/guards/module-subscription.guard';
import { ProductsController } from './products.controller';
import { ProductCategoriesController } from './product-categories.controller';
import { UomsController } from './uoms.controller';
import { ProductAttributesController } from './product-attributes.controller';
import { ALL_PRODUCTS_PERMISSIONS } from './products.permissions';

/** AGENTS.md rules 4 and 27: module gate on every controller, exactly one permission per endpoint. */
const controllers = [ProductsController, ProductCategoriesController, UomsController, ProductAttributesController];

function handlers(cls: new (...args: never[]) => object) {
  return Object.getOwnPropertyNames(cls.prototype)
    .filter((n) => n !== 'constructor')
    .map((n) => ({ name: `${cls.name}.${n}`, fn: (cls.prototype as Record<string, unknown>)[n] as object }));
}

describe('Products controllers', () => {
  it.each(controllers.map((c) => [c.name, c]))('%s requires the products module', (_n, cls) => {
    expect(Reflect.getMetadata(MODULE_KEY, cls)).toBe('products');
  });

  const all = controllers.flatMap((c) => handlers(c as never));

  it.each(all.map((h) => [h.name, h.fn]))('%s requires exactly one registered permission', (_n, fn) => {
    const perms: string[] = Reflect.getMetadata(PERMISSIONS_KEY, fn);
    expect(perms).toHaveLength(1);
    expect(ALL_PRODUCTS_PERMISSIONS).toContain(perms[0]);
  });

  it('uses every registered Products permission on at least one endpoint', () => {
    const used = new Set(all.flatMap((h) => Reflect.getMetadata(PERMISSIONS_KEY, h.fn) as string[]));
    expect(ALL_PRODUCTS_PERMISSIONS.filter((p) => !used.has(p))).toEqual([]);
  });
});
