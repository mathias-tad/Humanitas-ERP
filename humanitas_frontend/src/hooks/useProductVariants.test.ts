import { describe, expect, it } from 'vitest';
import { lineCombinations, previewVariantChanges, variantKey } from './useProductVariants';
import { toggleLineValue } from '@/components/products/VariantsPanel';
import { parseValueList } from '@/pages/products/AttributesPage';

const v = (ids: string[], is_active = true, auto_archived: 'config' | 'parent' | null = null) => ({
  is_active,
  auto_archived,
  variant_values: ids.map((value_id) => ({ attribute_id: 'a', attribute_name: 'A', value_id, value_name: value_id, html_color: null })),
});

describe('variant helpers', () => {
  it('makes one key per combination, whatever order values were picked in', () => {
    expect(lineCombinations([{ attribute_id: 'size', value_ids: ['m', 'l'] }, { attribute_id: 'color', value_ids: ['red'] }]))
      .toEqual([variantKey(['m', 'red']), variantKey(['l', 'red'])]);
    expect(variantKey(['b', 'a'])).toBe('a,b');
    expect(lineCombinations([])).toEqual([]);
    expect(lineCombinations([{ attribute_id: 'size', value_ids: [] }])).toEqual([]);
  });

  it('previews what saving will create, archive and restore', () => {
    const lines = [{ attribute_id: 'size', value_ids: ['m', 'l', 'xl'] }];
    const existing = [v(['m']), v(['s']), v(['xl'], false, 'config'), v(['l'], false, null)];
    // m kept; s archived; xl restored (removed earlier); l archived by hand stays archived, so nothing is created for it.
    expect(previewVariantChanges(lines, existing)).toEqual({ total: 3, create: 0, archive: 1, restore: 1 });
    expect(previewVariantChanges([{ attribute_id: 'size', value_ids: ['m', 'xxl'] }], [v(['m'])])).toEqual({ total: 2, create: 1, archive: 0, restore: 0 });
  });

  it('toggles a value in one line only', () => {
    const lines = [{ attribute_id: 'size', value_ids: ['m'] }, { attribute_id: 'color', value_ids: [] }];
    expect(toggleLineValue(lines, 'color', 'red')).toEqual([{ attribute_id: 'size', value_ids: ['m'] }, { attribute_id: 'color', value_ids: ['red'] }]);
    expect(toggleLineValue(lines, 'size', 'm')[0].value_ids).toEqual([]);
  });

  it('reads a typed value list', () => {
    expect(parseValueList('S, M,, l\nXL, m')).toEqual(['S', 'M', 'l', 'XL']);
  });
});
