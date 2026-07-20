/**
 * Server-side masking for public alumni payloads.
 *
 * This module exists because masking used to happen in the browser: the old
 * `searchAlumni` did `select("*")` and `ResultCard.jsx` called maskName/
 * maskWhatsapp at render time. The full names and phone numbers were already in
 * the client -- visible in the Network tab, or by deleting two function calls.
 *
 * A control that runs after the data has been sent is not a control. The fix is
 * that unmasked values never leave the server on a public route.
 *
 * See specs/07-security.md.
 */

/**
 * "Alvian Zachry Faturrahman" -> "Al**** Z***** F**********"
 *
 * Enough to recognise someone you already know, not enough to enumerate the
 * directory.
 */
export function maskName(fullName) {
  if (typeof fullName !== 'string') return '';

  // Split on any whitespace run, not a single space: the original split(' ')
  // produced empty strings for double spaces, and `w[0]` on those yielded the
  // literal "undefined" in rendered names.
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';

  const [first, ...rest] = parts;

  const firstMasked =
    first.length <= 2
      ? first + '*'
      : first.slice(0, 2) + '*'.repeat(first.length - 2);

  const restMasked = rest.map((w) => w[0] + '*'.repeat(Math.max(0, w.length - 1)));

  return [firstMasked, ...restMasked].join(' ');
}

/**
 * Fields a public (unauthenticated) caller may see.
 *
 * `whatsapp` is deliberately ABSENT rather than masked. A masked number
 * ("08**********") carries no information -- it is the same shape for everyone
 * -- while still shipping a field that only exists to be unmasked. The contact
 * flow routes through the admin number, so the alumnus's own number is never
 * needed client-side. `hasWhatsapp` carries the only bit the UI actually uses.
 */
export function toPublicAlumni(a) {
  return {
    id: a.id,
    namaLengkap: maskName(a.namaLengkap),
    angkatan: a.angkatan,
    perusahaan: a.perusahaan,
    jabatan: a.jabatan,
    bidangPekerjaan: a.bidangPekerjaan,
    subbidangPekerjaan: a.subbidangPekerjaan,
    domisiliKota: a.domisiliKota,
    domisiliProvinsi: a.domisiliProvinsi,
    hasWhatsapp: Boolean(a.whatsapp),
  };
}

/**
 * Prisma `select` matching the public payload.
 *
 * Passed to every public query so unmasked columns are never even read out of
 * the database -- defence in depth behind toPublicAlumni, and it keeps the
 * cross-host result set smaller.
 *
 * `whatsapp` IS selected because `hasWhatsapp` needs it, but it is dropped by
 * toPublicAlumni and must never be spread into a response.
 */
export const PUBLIC_ALUMNI_SELECT = {
  id: true,
  namaLengkap: true,
  angkatan: true,
  perusahaan: true,
  jabatan: true,
  bidangPekerjaan: true,
  subbidangPekerjaan: true,
  domisiliKota: true,
  domisiliProvinsi: true,
  whatsapp: true,
};
