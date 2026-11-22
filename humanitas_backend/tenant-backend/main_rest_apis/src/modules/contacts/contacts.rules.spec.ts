import { cleanTags, duplicateReason, normalizeTin, phoneKey } from './contacts.rules';

describe('contact rules', () => {
  it('accepts a 10-digit TIN, ignoring spaces and dashes', () => {
    expect(normalizeTin('0012 345-678')).toBe('0012345678');
    expect(normalizeTin('')).toBeNull();
    expect(normalizeTin(null)).toBeNull();
    expect(() => normalizeTin('12345')).toThrow('A TIN is 10 digits');
    expect(() => normalizeTin('00123456789')).toThrow();
  });

  it('treats 0911…, 911… and +251 911… as the same phone', () => {
    expect(phoneKey('0911 23 45 67')).toBe('251911234567');
    expect(phoneKey('911234567')).toBe('251911234567');
    expect(phoneKey('+251-911-234567')).toBe('251911234567');
    expect(phoneKey('00251911234567')).toBe('251911234567');
    expect(phoneKey('')).toBeNull();
  });

  it('cleans tags', () => {
    expect(cleanTags([' VIP ', 'vip', '', 'Addis'])).toEqual(['VIP', 'Addis']);
    expect(cleanTags(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(20);
  });

  it('finds the same contact by TIN, phone or email', () => {
    const c = { id: 'c1', code: 'C000001', name: 'Abebe Trading', tin: '0012345678', phone: '+251911234567', mobile: null, email: 'Info@Abebe.et' };
    expect(duplicateReason({ tin: '0012345678' }, c)).toBe('same TIN');
    expect(duplicateReason({ mobile: '0911234567' }, c)).toBe('same phone');
    expect(duplicateReason({ email: 'info@abebe.et' }, c)).toBe('same email');
    expect(duplicateReason({ tin: '9999999999', phone: '0922000000' }, c)).toBeNull();
  });
});
