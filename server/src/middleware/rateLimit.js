import rateLimit from 'express-rate-limit';

/**
 * Rate limiters.
 *
 * All of these key on the client IP. Behind Cloudflare that is NOT req.socket's
 * address -- every request arrives from a Cloudflare edge IP, which would
 * collapse all users into one shared bucket and let a handful of people lock
 * out everyone else. `app.set('trust proxy', ...)` in index.js is what makes
 * req.ip the real visitor address.
 *
 * That setting is only safe because the origin firewall restricts port 443 to
 * Cloudflare ranges; otherwise anyone could spoof X-Forwarded-For and bypass
 * every limit here. See specs/06-cicd.md.
 */

const json = (message) => (req, res) => res.status(429).json({ error: message });

/**
 * Login is the sensitive one: phone numbers are a far smaller and more
 * guessable keyspace than emails, so password auth on a public endpoint is
 * brute-forceable without this.
 *
 * Keyed on IP + phone so one attacker cannot lock out a specific user by
 * hammering their number from many IPs, nor sweep many numbers from one IP.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.phone ?? '').slice(0, 32)}`,
  skipSuccessfulRequests: true,
  handler: json('Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.'),
});

/**
 * The public alumni submission endpoint is unauthenticated by design, so
 * nothing else stops a script from filling the table -- and the table feeds the
 * public statistics page, so injected rows distort published figures.
 */
export const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json('Terlalu banyak pengiriman. Coba lagi nanti.'),
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json('Terlalu banyak permintaan. Coba lagi sebentar lagi.'),
});

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json('Terlalu banyak permintaan.'),
});
