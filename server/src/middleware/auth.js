import jwt from 'jsonwebtoken';
import { env, isProduction } from '../env.js';

export const COOKIE_NAME = 'iaku_session';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Session handling.
 *
 * The token lives in an httpOnly cookie, not localStorage (where Supabase kept
 * it): httpOnly means an XSS bug -- including one from a compromised npm
 * dependency -- cannot read or exfiltrate the session.
 *
 * Trade-off, accepted knowingly: a stateless JWT cannot be revoked before it
 * expires. Logout clears the cookie, but a token already copied off the machine
 * stays valid for up to 7 days. See specs/03-auth.md for when to add a
 * sessions table instead.
 */

export function signSession(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, alumniId: user.alumniId ?? null },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction, // HTTPS only in prod; plain HTTP in local dev
    sameSite: 'lax', // blocks CSRF on state-changing cross-site requests
    path: '/',
    maxAge: MAX_AGE_MS,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/' });
}

/**
 * Populates req.user when a valid session cookie is present. Never rejects --
 * routes that require a session use requireAuth below.
 *
 * An invalid or expired token is treated as "no session" rather than an error:
 * the practical case is an expired cookie, and a 500 there would be wrong.
 */
export function attachUser(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role, alumniId: payload.alumniId ?? null };
  } catch {
    req.user = undefined;
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Silakan masuk terlebih dahulu' });
  next();
}
