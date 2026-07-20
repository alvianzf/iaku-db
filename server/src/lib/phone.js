/**
 * Phone-number normalisation to E.164.
 *
 * Login identity depends on this: `users.phone_e164` is UNIQUE, so the same
 * human typing their number a different way must produce the same string or
 * they get a second account (or cannot log in at all).
 *
 * See specs/03-auth.md.
 */

export class PhoneError extends Error {
  constructor(reason) {
    super(`invalid phone: ${reason}`);
    this.name = 'PhoneError';
    this.reason = reason;
  }
}

// E.164 permits at most 15 digits. The floor is deliberately loose because
// country codes vary; the Indonesian-specific length check is separate.
const E164_MAX = 15;
const E164_MIN = 8;

// Indonesian mobile numbers are 62 + 8xx + 7-11 more digits.
const ID_MIN = 10; // 62 + 8 digits
const ID_MAX = 15;

/**
 * @param {string} input raw user-entered number
 * @returns {string} E.164, e.g. "+6281234567890"
 * @throws {PhoneError}
 */
export function normalizePhone(input) {
  if (typeof input !== 'string') throw new PhoneError('empty');

  const trimmed = input.trim();
  if (!trimmed) throw new PhoneError('empty');

  // A leading "+" is the only non-digit that carries meaning. Everything else
  // (spaces, dashes, parens, dots, and the non-breaking spaces that arrive via
  // copy-paste from WhatsApp and Excel) is decoration.
  const hasPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');

  if (!digits) throw new PhoneError('no-digits');

  if (hasPlus) {
    // Already international. E.164 never has a 0 directly after the country
    // code, so "+0..." is a malformed paste rather than a number we can rescue.
    if (digits.startsWith('0')) throw new PhoneError('unrecognized-format');
  } else if (digits.startsWith('00')) {
    // "00" is the international dial-out prefix — equivalent to "+".
    digits = digits.slice(2);
    if (!digits || digits.startsWith('0')) throw new PhoneError('unrecognized-format');
  } else if (digits.startsWith('62')) {
    // Country code without the "+".
  } else if (digits.startsWith('0')) {
    // Indonesian trunk prefix: 0812... -> 62812...
    // Must be tested before the bare-"8" rule below.
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    // Trunk prefix omitted entirely: 812... -> 62812...
    digits = '62' + digits;
  } else {
    throw new PhoneError('unrecognized-format');
  }

  if (digits.length < E164_MIN) throw new PhoneError('too-short');
  if (digits.length > E164_MAX) throw new PhoneError('too-long');

  if (digits.startsWith('62')) {
    // The field is *WhatsApp*. A 62 number whose subscriber part does not start
    // with 8 is a landline or a typo, not a mobile.
    if (digits[2] !== '8') throw new PhoneError('not-mobile');
    if (digits.length < ID_MIN) throw new PhoneError('too-short');
    if (digits.length > ID_MAX) throw new PhoneError('too-long');
  }

  return '+' + digits;
}

/**
 * Non-throwing variant for bulk work (the backfill) and form validation, where
 * a failure is data to record rather than an exception to handle.
 *
 * @returns {{ok: true, value: string} | {ok: false, reason: string}}
 */
export function tryNormalizePhone(input) {
  try {
    return { ok: true, value: normalizePhone(input) };
  } catch (err) {
    if (err instanceof PhoneError) return { ok: false, reason: err.reason };
    throw err;
  }
}
