import { describe, it, expect } from 'vitest';
import { normalizePhone, tryNormalizePhone, PhoneError } from './phone.js';

describe('normalizePhone — the eight spellings must collapse to one', () => {
  // This is the whole point of the function: these are all one human, and
  // users.phone_e164 is UNIQUE.
  const SAME_NUMBER = [
    '0812-3456-7890',
    '081234567890',
    '(0812) 34567890',
    '0812 3456 7890',
    '+62 812 3456 7890',
    '+6281234567890',
    '62812 3456 7890',
    '+62-812-3456-7890',
    '812-3456-7890',
    '006281234567890',
  ];

  it.each(SAME_NUMBER)('%s -> +6281234567890', (input) => {
    expect(normalizePhone(input)).toBe('+6281234567890');
  });

  it('every spelling produces exactly one distinct value', () => {
    const distinct = new Set(SAME_NUMBER.map(normalizePhone));
    expect(distinct.size).toBe(1);
  });
});

describe('idempotence', () => {
  // The backfill must be safe to re-run; already-normalised rows pass through.
  it('normalising twice equals normalising once', () => {
    const once = normalizePhone('0812-3456-7890');
    expect(normalizePhone(once)).toBe(once);
  });
});

describe('whitespace and paste artifacts', () => {
  it('strips non-breaking spaces (copy-paste from WhatsApp/Excel)', () => {
    expect(normalizePhone('0812 3456 7890')).toBe('+6281234567890');
  });

  it('strips leading/trailing whitespace', () => {
    expect(normalizePhone('  081234567890  ')).toBe('+6281234567890');
  });

  it('strips dots', () => {
    expect(normalizePhone('0812.3456.7890')).toBe('+6281234567890');
  });
});

describe('international numbers are preserved, not forced to +62', () => {
  it('keeps a US number', () => {
    expect(normalizePhone('+1 415 555 0123')).toBe('+14155550123');
  });

  it('keeps a Singapore number', () => {
    expect(normalizePhone('+65 8123 4567')).toBe('+6581234567');
  });
});

describe('rejections', () => {
  const cases = [
    ['', 'empty'],
    ['   ', 'empty'],
    ['abcdefgh', 'no-digits'],
    ['+628', 'too-short'],
    ['0812', 'too-short'],
    ['+6281234567890123456', 'too-long'],
    ['+0812345678', 'unrecognized-format'],
    ['12345678', 'unrecognized-format'],
  ];

  it.each(cases)('rejects %j as %s', (input, reason) => {
    expect(() => normalizePhone(input)).toThrow(PhoneError);
    expect(tryNormalizePhone(input)).toEqual({ ok: false, reason });
  });

  it('rejects an Indonesian landline — the field is WhatsApp', () => {
    // 62 21 ... is a Jakarta landline, not a mobile.
    expect(tryNormalizePhone('+62 21 1234 5678')).toEqual({
      ok: false,
      reason: 'not-mobile',
    });
  });

  it.each([null, undefined, 12345, {}, []])('rejects non-string %j', (input) => {
    expect(() => normalizePhone(input)).toThrow(PhoneError);
  });
});

describe('tryNormalizePhone', () => {
  it('returns ok:true with the value on success', () => {
    expect(tryNormalizePhone('081234567890')).toEqual({
      ok: true,
      value: '+6281234567890',
    });
  });

  it('never throws PhoneError — the backfill relies on this', () => {
    expect(() => tryNormalizePhone('garbage')).not.toThrow();
  });
});
