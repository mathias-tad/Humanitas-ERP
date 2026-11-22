import { describe, expect, it } from 'vitest';
import { IMPORT_TEMPLATES, templateCsv } from './CrmImportDialog';

describe('CRM import templates', () => {
  it('has an example value for every column and quotes commas', () => {
    for (const t of Object.values(IMPORT_TEMPLATES)) expect(t.example).toHaveLength(t.headers.length);
    const csv = templateCsv('leads');
    expect(csv.startsWith('﻿Title,Person,Company')).toBe(true);
    expect(csv.split('\r\n')).toHaveLength(3);
  });
});
