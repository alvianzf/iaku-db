/**
 * Role and ownership checks.
 *
 * These are the real authorisation boundary. The frontend hides controls a role
 * cannot use, but hiding a button is presentation -- the old Dashboard gated on
 * a client-side session check while its data fetch ran unconditionally, which
 * is exactly why this belongs on the server.
 */

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Silakan masuk terlebih dahulu' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses' });
    }
    next();
  };
}

export const requireAdmin = requireRole('ADMIN');

/**
 * An ADMIN may act on any alumni record; an ALUMNI only on their own.
 *
 * Ownership is read from the TOKEN (req.user.alumniId), never from the request
 * body -- otherwise a caller could claim any record by sending its id.
 */
export function requireAlumniOwnershipOrAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Silakan masuk terlebih dahulu' });
  if (req.user.role === 'ADMIN') return next();
  if (req.user.alumniId && req.user.alumniId === req.params.id) return next();
  return res.status(403).json({ error: 'Anda tidak memiliki akses' });
}
