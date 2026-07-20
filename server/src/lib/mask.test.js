import { describe, it, expect } from 'vitest';
import { maskName, toPublicAlumni, PUBLIC_ALUMNI_SELECT } from './mask.js';

describe('maskName', () => {
  it('masks a three-part name', () => {
    expect(maskName('Alvian Zachry Faturrahman')).toBe('Al**** Z***** F**********');
  });

  it('masks a single name', () => {
    expect(maskName('Sukarno')).toBe('Su*****');
  });

  it('masks a two-part name', () => {
    expect(maskName('Budi Santoso')).toBe('Bu** S******');
  });

  it('handles collapsed whitespace without emitting "undefined"', () => {
    // The original split(' ') produced empty parts for double spaces, and
    // w[0] on those rendered the literal string "undefined".
    expect(maskName('Budi   Santoso')).toBe('Bu** S******');
    expect(maskName('Budi\tSantoso')).toBe('Bu** S******');
  });

  it('always masks at least one character of a short first name', () => {
    expect(maskName('Al')).toBe('Al*');
    expect(maskName('A')).toBe('A*');
  });

  it.each([null, undefined, 123, {}, [], ''])('returns "" for %j', (input) => {
    expect(maskName(input)).toBe('');
  });

  it('returns "" for whitespace only', () => {
    expect(maskName('   ')).toBe('');
  });

  it('never leaks a full name fragment beyond the first two characters', () => {
    const name = 'Alvian Zachry Faturrahman';
    const masked = maskName(name);
    expect(masked).not.toContain('vian');
    expect(masked).not.toContain('Zachry');
    expect(masked).not.toContain('Faturrahman');
  });
});

describe('toPublicAlumni', () => {
  const row = {
    id: 'uuid-1',
    namaLengkap: 'Alvian Zachry Faturrahman',
    angkatan: 2015,
    perusahaan: 'PT Pertamina',
    jabatan: 'Analis',
    bidangPekerjaan: 'Energi',
    subbidangPekerjaan: 'Hulu',
    domisiliKota: 'Bandung',
    domisiliProvinsi: 'Jawa Barat',
    whatsapp: '+6281234567890',
    passwordHash: 'should-never-appear',
    createdAt: new Date(),
  };

  const out = toPublicAlumni(row);

  // This is the P0 regression guard. If it ever fails, the public search is
  // leaking contact details again.
  it('does NOT include the whatsapp number in any form', () => {
    expect(out).not.toHaveProperty('whatsapp');
    expect(JSON.stringify(out)).not.toContain('6281234567890');
    expect(JSON.stringify(out)).not.toContain('81234567890');
  });

  it('does not leak the unmasked name', () => {
    expect(JSON.stringify(out)).not.toContain('Faturrahman');
    expect(out.namaLengkap).toBe('Al**** Z***** F**********');
  });

  it('exposes only hasWhatsapp as a boolean', () => {
    expect(out.hasWhatsapp).toBe(true);
    expect(toPublicAlumni({ ...row, whatsapp: null }).hasWhatsapp).toBe(false);
    expect(toPublicAlumni({ ...row, whatsapp: '' }).hasWhatsapp).toBe(false);
  });

  it('drops any field not on the allowlist', () => {
    // Guards against mass-disclosure if a column is added to the model later:
    // the payload is built by picking, never by spreading.
    expect(out).not.toHaveProperty('passwordHash');
    expect(out).not.toHaveProperty('createdAt');
    expect(Object.keys(out).sort()).toEqual([
      'angkatan',
      'bidangPekerjaan',
      'domisiliKota',
      'domisiliProvinsi',
      'hasWhatsapp',
      'id',
      'jabatan',
      'namaLengkap',
      'perusahaan',
      'subbidangPekerjaan',
    ]);
  });

  it('passes through non-identifying fields unchanged', () => {
    expect(out.angkatan).toBe(2015);
    expect(out.perusahaan).toBe('PT Pertamina');
    expect(out.domisiliKota).toBe('Bandung');
  });
});

describe('PUBLIC_ALUMNI_SELECT', () => {
  it('never selects the password hash or other user columns', () => {
    expect(PUBLIC_ALUMNI_SELECT).not.toHaveProperty('passwordHash');
  });

  it('covers every field the public payload reads', () => {
    // whatsapp is selected because hasWhatsapp derives from it, then dropped.
    const needed = [
      'id',
      'namaLengkap',
      'angkatan',
      'perusahaan',
      'jabatan',
      'bidangPekerjaan',
      'subbidangPekerjaan',
      'domisiliKota',
      'domisiliProvinsi',
      'whatsapp',
    ];
    expect(Object.keys(PUBLIC_ALUMNI_SELECT).sort()).toEqual(needed.sort());
  });
});
