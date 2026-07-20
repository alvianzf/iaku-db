/**
 * User-facing copy for phone validation failures.
 *
 * Separate from phone.js (which stays pure) and from the routes, so the
 * submission form and the admin user-creation form cannot drift apart.
 */
export function phoneMessage(reason) {
  switch (reason) {
    case 'not-mobile':
      return 'Nomor tersebut bukan nomor ponsel. Masukkan nomor WhatsApp.';
    case 'unknown-country':
      return 'Negara tidak dikenali.';
    case 'empty':
    case 'no-digits':
      return 'Nomor WhatsApp wajib diisi.';
    default:
      return 'Format nomor tidak valid. Contoh: 812 3456 7890';
  }
}
