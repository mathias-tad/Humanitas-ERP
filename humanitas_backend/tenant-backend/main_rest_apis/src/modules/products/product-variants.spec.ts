import { combinationCount, combinations, planVariants, valueSkuCode, variantKey, variantName, variantSku, type AttributeLine } from './product-variants';

const v = (id: string, name: string, sort_order: number, code: string | null = null) => ({ id, name, code, sort_order });
const COLOR: AttributeLine = { attribute_id: 'color', attribute_name: 'Color', sort_order: 2, values: [v('c2', 'Blue', 2, 'BLU'), v('c1', 'Red', 1, 'RED')] };
const SIZE: AttributeLine = { attribute_id: 'size', attribute_name: 'Size', sort_order: 1, values: [v('s1', 'M', 1), v('s2', 'Extra Large', 2)] };

describe('variant matrix', () => {
  it('makes one combination per value of each attribute, in display order', () => {
    const list = combinations([COLOR, SIZE]);
    expect(list.map((c) => c.label)).toEqual(['M, Red', 'M, Blue', 'Extra Large, Red', 'Extra Large, Blue']);
    expect(list[0].skuSuffix).toBe('M-RED');
    expect(list[2].skuSuffix).toBe('EXTRA-LARGE-RED');
    expect(list[0].key).toBe(variantKey(['c1', 's1']));
    expect(combinationCount([COLOR, SIZE])).toBe(4);
    expect(combinations([])).toEqual([]);
    expect(combinations([{ ...SIZE, values: [] }])).toEqual([]);
  });

  it('keys ignore value order', () => {
    expect(variantKey(['b', 'a'])).toBe(variantKey(['a', 'b']));
  });

  it('names and SKUs variants from the parent', () => {
    expect(variantName('T-shirt', 'Red, M')).toBe('T-shirt (Red, M)');
    expect(variantName('x'.repeat(260), 'Red').length).toBe(255);
    expect(variantSku('TSHIRT', 'RED-M')).toBe('TSHIRT-RED-M');
    expect(variantSku(null, 'RED-M')).toBeNull();
    expect(valueSkuCode({ name: 'Café crème', code: null })).toBe('CAFE-CREME');
  });

  it('plans creates, archives and restores against the existing variants', () => {
    const lines = [SIZE, { ...COLOR, values: [COLOR.values[1]] }]; // Red only
    const existing = [
      { id: 'v1', variant_key: variantKey(['s1', 'c1']), is_active: true, auto_archived: null },
      { id: 'v2', variant_key: variantKey(['s1', 'c2']), is_active: true, auto_archived: null },
      { id: 'v3', variant_key: variantKey(['s2', 'c1']), is_active: false, auto_archived: 'config' as const },
    ];
    const plan = planVariants(lines, existing);
    expect(plan.create).toEqual([]);
    expect(plan.archive.map((x) => x.id)).toEqual(['v2']);
    expect(plan.restore.map((x) => x.id)).toEqual(['v3']);
    expect(plan.keep.map((k) => k.variant.id).sort()).toEqual(['v1', 'v3']);
  });

  it('does not bring back a variant archived by hand', () => {
    const existing = [{ id: 'v1', variant_key: variantKey(['s1']), is_active: false, auto_archived: null }];
    const plan = planVariants([{ ...SIZE, values: [SIZE.values[0]] }], existing);
    expect(plan.restore).toEqual([]);
    expect(plan.create).toEqual([]);
  });
});
