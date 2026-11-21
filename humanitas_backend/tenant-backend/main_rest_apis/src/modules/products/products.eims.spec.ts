import { EIMS_READY_SQL, EIMS_TAX_CODES, eimsDescription, eimsIssues, withEimsStatus } from './products.eims';

describe('products.eims (AGENTS.md rule 28)', () => {
  const ok = { item_code: 'P0000001', name: 'Teff flour 1kg', tax_code: 'VAT15', uom_mor_code: 'KLG' };

  it('knows the MoR line tax codes and their rates', () => {
    expect(EIMS_TAX_CODES).toEqual({ VAT15: 15, VAT0: 0, VATEX: 0, TOT2: 2, TOT10: 10 });
  });

  it('uses the invoice description when set, otherwise the name', () => {
    expect(eimsDescription(ok)).toBe('Teff flour 1kg');
    expect(eimsDescription({ ...ok, invoice_description: '  Teff 1kg  ' })).toBe('Teff 1kg');
    expect(eimsDescription({ ...ok, invoice_description: '   ' })).toBe('Teff flour 1kg');
  });

  it('flags each field MoR would reject', () => {
    expect(eimsIssues(ok)).toEqual([]);
    expect(eimsIssues({ ...ok, item_code: 'TOO-LONG-ITEM-CODE' })).toEqual(['item_code']);
    expect(eimsIssues({ ...ok, name: 'x'.repeat(101) })).toEqual(['description']);
    expect(eimsIssues({ ...ok, name: 'x'.repeat(101), invoice_description: 'short' })).toEqual([]);
    expect(eimsIssues({ ...ok, uom_mor_code: null })).toEqual(['unit']);
    expect(eimsIssues({ ...ok, tax_code: 'VAT5' })).toEqual(['tax_code']);
  });

  it('attaches the readiness flags to a row', () => {
    expect(withEimsStatus({ ...ok, uom_mor_code: null })).toMatchObject({ eims_ready: false, eims_issues: ['unit'] });
  });

  it('keeps the SQL readiness filter in step with the 100-character description limit', () => {
    expect(EIMS_READY_SQL).toContain('u.mor_code IS NOT NULL');
    expect(EIMS_READY_SQL).toContain('<= 100');
  });
});
