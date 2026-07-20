import { describe, it, expect } from 'vitest';
import {
  normalizePhone,
  tryNormalizePhone,
  countryOptions,
  PhoneError,
  DEFAULT_COUNTRY,
} from './phone.js';

describe('the spellings of one Indonesian number must collapse to one', () => {
  // This is the whole point of the function: these are all one human, and
  // users.phone_e164 is UNIQUE.
  const SAME_NUMBER = [
    '0812-3456-7890',
    '081234567890',
    '(0812) 34567890',
    '0812 3456 7890',
    '0812.3456.7890',
    '  081234567890  ',
    '+62 812 3456 7890',
    '+6281234567890',
    '62812 3456 7890',
    '+62-812-3456-7890',
    '812-3456-7890',
    '006281234567890',
    '0062 812 3456 7890',
  ];

  it.each(SAME_NUMBER)('%s -> +6281234567890', (input) => {
    expect(normalizePhone(input)).toBe('+6281234567890');
  });

  it('every spelling produces exactly one distinct value', () => {
    const distinct = new Set(SAME_NUMBER.map((s) => normalizePhone(s)));
    expect(distinct.size).toBe(1);
  });

  it('the 00 international prefix is stripped, not appended', () => {
    // libphonenumber does not strip "00" when given a default country -- it
    // yields "+62006281234567890". Regression guard for that.
    expect(normalizePhone('006281234567890')).toBe('+6281234567890');
  });
});

describe('idempotence', () => {
  // The backfill must be safe to re-run; already-normalised rows pass through.
  it.each(['0812-3456-7890', '+14155550123', '+447911123456'])(
    're-normalising %s is a no-op',
    (input) => {
      const once = normalizePhone(input);
      expect(normalizePhone(once)).toBe(once);
    }
  );
});

describe('national input with a country selector', () => {
  // The UI is [country ▾][national number], so these arrive without a code.
  const cases = [
    ['081234567890', 'ID', '+6281234567890'],
    ['4155550123', 'US', '+14155550123'],
    ['81234567', 'SG', '+6581234567'],
    ['7911123456', 'GB', '+447911123456'],
    ['412345678', 'AU', '+61412345678'],
    ['9012345678', 'JP', '+819012345678'],
    ['612345678', 'NL', '+31612345678'],
    ['123456789', 'MY', '+60123456789'],
    ['0123456789', 'MY', '+60123456789'], // MY trunk prefix also stripped
  ];

  it.each(cases)('%s (%s) -> %s', (input, country, expected) => {
    expect(normalizePhone(input, country)).toBe(expected);
  });
});

describe('international form wins over the selected country', () => {
  it('a +1 number stays US even when ID is selected', () => {
    expect(normalizePhone('+1 415 555 0123', 'ID')).toBe('+14155550123');
  });

  it('a +62 number stays ID even when US is selected', () => {
    expect(normalizePhone('+62 812 3456 7890', 'US')).toBe('+6281234567890');
  });
});

describe('defaults', () => {
  it('defaults to Indonesia', () => {
    expect(DEFAULT_COUNTRY).toBe('ID');
    expect(normalizePhone('081234567890')).toBe(
      normalizePhone('081234567890', 'ID')
    );
  });
});

describe('rejections', () => {
  const cases = [
    ['', 'ID', 'empty'],
    ['   ', 'ID', 'empty'],
    ['abcdefgh', 'ID', 'no-digits'],
    ['0812', 'ID', 'invalid-number'],
    ['+6281234567890123456', 'ID', 'invalid-number'],
    ['4155550123', 'ID', 'invalid-number'],
    ['081234567890', 'ZZ', 'unknown-country'],
  ];

  it.each(cases)('rejects %j (%s) as %s', (input, country, reason) => {
    expect(() => normalizePhone(input, country)).toThrow(PhoneError);
    expect(tryNormalizePhone(input, country)).toEqual({ ok: false, reason });
  });

  // The field is a WhatsApp number, so landlines are rejected everywhere the
  // numbering plan makes them distinguishable.
  describe('landlines are rejected', () => {
    const landlines = [
      ['2112345678', 'ID'], // Jakarta
      ['+62 21 1234 5678', 'ID'],
      ['2079460958', 'GB'], // London
      ['3012345678', 'DE'], // Berlin
      ['212345678', 'AU'], // Sydney
      ['201234567', 'NL'], // Amsterdam
      ['62345678', 'SG'],
      ['1123456789', 'IN'], // Delhi
    ];

    it.each(landlines)('rejects %s (%s) as not-mobile', (input, country) => {
      expect(tryNormalizePhone(input, country)).toEqual({
        ok: false,
        reason: 'not-mobile',
      });
    });
  });

  it('accepts US/Canada numbers — the NANP cannot distinguish mobile', () => {
    // US and Canada are the ONLY countries that report FIXED_LINE_OR_MOBILE:
    // a NANP number carries no mobile/landline distinction at all. Rejecting
    // the type would lock out every US and Canadian alumnus, so it is accepted.
    // This is the one place a landline can slip through, and it is unavoidable.
    expect(tryNormalizePhone('4155550123', 'US').ok).toBe(true);
    expect(tryNormalizePhone('4165550123', 'CA').ok).toBe(true);
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

describe('countryOptions', () => {
  const options = countryOptions();

  it('puts Indonesia first — it is the default', () => {
    expect(options[0]).toEqual({ code: 'ID', dialCode: '+62' });
  });

  it('covers every country libphonenumber knows', () => {
    expect(options.length).toBeGreaterThan(200);
  });

  it('every entry has a dial code', () => {
    expect(options.every((o) => /^\+\d+$/.test(o.dialCode))).toBe(true);
  });

  it('has no duplicate country codes', () => {
    expect(new Set(options.map((o) => o.code)).size).toBe(options.length);
  });
});
