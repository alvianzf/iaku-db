/**
 * Phone-number normalisation to E.164, multi-country.
 *
 * Login identity depends on this: `users.phone_e164` is UNIQUE, so the same
 * human typing their number a different way must produce the same string or
 * they get a second account (or cannot log in at all).
 *
 * The UI pairs a country selector with a national-number field, so callers
 * normally pass an explicit `country`. `input` may still be in international
 * form (+62...), in which case it wins over `country`.
 *
 * See specs/03-auth.md.
 */

// The `/max` entrypoint, not the default. The default (min) metadata cannot
// report number *type*, so it cannot tell a mobile from a landline -- and it
// wrongly reported "006281234567890" as valid. Costs more bytes; server-side
// that is irrelevant, and correctness here is the whole point of the module.
import { parsePhoneNumberFromString, getCountries, getCountryCallingCode } from 'libphonenumber-js/max';

export class PhoneError extends Error {
  constructor(reason) {
    super(`invalid phone: ${reason}`);
    this.name = 'PhoneError';
    this.reason = reason;
  }
}

export const DEFAULT_COUNTRY = 'ID';

export const SUPPORTED_COUNTRIES = new Set(getCountries());

/**
 * Types that can plausibly hold a WhatsApp account.
 *
 * FIXED_LINE_OR_MOBILE must be accepted -- many countries (the US among them)
 * cannot distinguish, and rejecting it would lock out every US alumnus.
 * A definite FIXED_LINE is rejected: the field is WhatsApp, and a landline is
 * almost always a mistyped or wrong-field entry.
 *
 * Trade-off: WhatsApp Business *can* run on a landline. If that turns out to
 * matter for this alumni base, drop 'FIXED_LINE' from the reject list -- the
 * failure mode is a rejected valid number, which users will report.
 */
const MOBILE_CAPABLE = new Set([undefined, 'MOBILE', 'FIXED_LINE_OR_MOBILE']);

/**
 * @param {string} input raw user-entered number, national or international
 * @param {string} [country] ISO 3166-1 alpha-2, e.g. "ID". Used when `input`
 *   carries no country code. Defaults to Indonesia.
 * @returns {string} E.164, e.g. "+6281234567890"
 * @throws {PhoneError}
 */
export function normalizePhone(input, country = DEFAULT_COUNTRY) {
  if (typeof input !== 'string') throw new PhoneError('empty');

  let value = input.trim();
  if (!value) throw new PhoneError('empty');
  if (!/\d/.test(value)) throw new PhoneError('no-digits');

  // "00" is the international dial-out prefix -- equivalent to "+".
  // libphonenumber does NOT strip it when a default country is supplied: it
  // parses "006281234567890" as a national number and yields the nonsense
  // "+62006281234567890". Normalising it to "+" first is what makes the common
  // "0062..." paste work instead of merely failing validation.
  if (/^00\d/.test(value.replace(/[^\d]/g, '')) && !value.startsWith('+')) {
    value = '+' + value.replace(/[^\d]/g, '').slice(2);
  }

  if (country && !SUPPORTED_COUNTRIES.has(country)) {
    throw new PhoneError('unknown-country');
  }

  const parsed = parsePhoneNumberFromString(value, country);
  if (!parsed) throw new PhoneError('unrecognized-format');
  if (!parsed.isValid()) throw new PhoneError('invalid-number');

  if (!MOBILE_CAPABLE.has(parsed.getType())) throw new PhoneError('not-mobile');

  return parsed.number; // always E.164
}

/**
 * Non-throwing variant for bulk work (the legacy backfill) and form validation,
 * where a failure is data to record rather than an exception to handle.
 *
 * @returns {{ok: true, value: string} | {ok: false, reason: string}}
 */
export function tryNormalizePhone(input, country = DEFAULT_COUNTRY) {
  try {
    return { ok: true, value: normalizePhone(input, country) };
  } catch (err) {
    if (err instanceof PhoneError) return { ok: false, reason: err.reason };
    throw err;
  }
}

/**
 * Country list for the UI's selector: ISO code + dial code.
 * Indonesia first (the default), then alphabetical by code.
 */
export function countryOptions() {
  const rest = getCountries()
    .filter((c) => c !== DEFAULT_COUNTRY)
    .sort();
  return [DEFAULT_COUNTRY, ...rest].map((code) => ({
    code,
    dialCode: `+${getCountryCallingCode(code)}`,
  }));
}
