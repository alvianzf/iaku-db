import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from './app.js';
import { env } from './env.js';
import { COOKIE_NAME } from './middleware/auth.js';

/**
 * Route-level tests that do not require a database.
 *
 * They cover the wiring that is easy to get wrong and expensive to get wrong:
 * authorisation, validation, and the shape of error responses. Routes that hit
 * Postgres are covered separately once the database is reachable.
 */

const app = createApp();

const tokenFor = (payload) => jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' });
const asUser = (req, payload) =>
  req.set('Cookie', [`${COOKIE_NAME}=${tokenFor(payload)}`]);

const ALUMNI = { sub: 'user-1', role: 'ALUMNI', alumniId: 'alumni-1' };
const ADMIN = { sub: 'user-2', role: 'ADMIN', alumniId: null };

describe('health', () => {
  it('responds without touching the database', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('unknown routes', () => {
  it('404s as JSON, not HTML', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });
});

describe('security headers', () => {
  it('does not advertise Express', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('sets helmet headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('meta', () => {
  it('serves the country list so the client need not bundle metadata', async () => {
    const res = await request(app).get('/api/meta/countries');
    expect(res.status).toBe(200);
    expect(res.body[0]).toEqual({ code: 'ID', dialCode: '+62' });
    expect(res.body.length).toBeGreaterThan(200);
  });

  it('serves the broker contact number', async () => {
    const res = await request(app).get('/api/meta/contact');
    expect(res.status).toBe(200);
    expect(res.body.adminWhatsapp).toMatch(/^\+\d+$/);
  });
});

describe('authorisation — enforced server-side, not by hiding buttons', () => {
  it('GET /api/alumni requires a session', async () => {
    const res = await request(app).get('/api/alumni');
    expect(res.status).toBe(401);
  });

  it('GET /api/alumni rejects a non-admin with 403', async () => {
    const res = await asUser(request(app).get('/api/alumni'), ALUMNI);
    expect(res.status).toBe(403);
  });

  it('DELETE /api/alumni/:id rejects an ALUMNI even on their own record', async () => {
    // Deletion is irreversible and there is no undo, so it is admin-only.
    const res = await asUser(request(app).delete('/api/alumni/alumni-1'), ALUMNI);
    expect(res.status).toBe(403);
  });

  it('POST /api/auth/users requires a session', async () => {
    const res = await request(app).post('/api/auth/users').send({});
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/users rejects a non-admin — the old signUp was public', async () => {
    const res = await asUser(request(app).post('/api/auth/users'), ALUMNI).send({
      phone: '081234567890',
      password: 'a-long-enough-password',
    });
    expect(res.status).toBe(403);
  });

  it('PATCH /api/alumni/:id rejects an ALUMNI editing someone else', async () => {
    const res = await asUser(request(app).patch('/api/alumni/someone-else'), ALUMNI).send({
      namaLengkap: 'Hacked',
    });
    expect(res.status).toBe(403);
  });

  it('GET /api/auth/me returns 401 without a session', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('treats a forged token as no session', async () => {
    const forged = jwt.sign(ADMIN, 'not-the-real-secret', { expiresIn: '1h' });
    const res = await request(app)
      .get('/api/alumni')
      .set('Cookie', [`${COOKIE_NAME}=${forged}`]);
    expect(res.status).toBe(401);
  });

  it('treats an expired token as no session', async () => {
    const expired = jwt.sign(ADMIN, env.JWT_SECRET, { expiresIn: '-1s' });
    const res = await request(app)
      .get('/api/alumni')
      .set('Cookie', [`${COOKIE_NAME}=${expired}`]);
    expect(res.status).toBe(401);
  });
});

describe('validation happens before the database is touched', () => {
  it('rejects a search under 2 characters', async () => {
    const res = await request(app).get('/api/alumni/search?q=a');
    expect(res.status).toBe(400);
    expect(res.body.fields?.[0].path).toBe('q');
  });

  it('rejects a missing query', async () => {
    const res = await request(app).get('/api/alumni/search');
    expect(res.status).toBe(400);
  });

  it('caps limit at 100 — an uncapped take would dump the table', async () => {
    const res = await request(app).get('/api/alumni/search?q=budi&limit=99999');
    expect(res.status).toBe(400);
    expect(res.body.fields?.[0].path).toBe('limit');
  });

  it('rejects a submission with an out-of-range angkatan', async () => {
    const res = await request(app).post('/api/alumni').send({
      namaLengkap: 'Budi Santoso',
      angkatan: 1200,
      whatsapp: '081234567890',
    });
    expect(res.status).toBe(400);
    expect(res.body.fields?.some((f) => f.path === 'angkatan')).toBe(true);
  });

  it('rejects a submission with an invalid phone, with a field-level message', async () => {
    const res = await request(app).post('/api/alumni').send({
      namaLengkap: 'Budi Santoso',
      angkatan: 2015,
      whatsapp: 'not-a-number',
    });
    expect(res.status).toBe(400);
    expect(res.body.fields?.[0].path).toBe('whatsapp');
  });

  it('rejects an Indonesian landline as a WhatsApp number', async () => {
    const res = await request(app).post('/api/alumni').send({
      namaLengkap: 'Budi Santoso',
      angkatan: 2015,
      whatsapp: '02112345678',
    });
    expect(res.status).toBe(400);
    expect(res.body.fields?.[0].message).toMatch(/ponsel/i);
  });

  it('rejects a short password on user creation', async () => {
    const res = await asUser(request(app).post('/api/auth/users'), ADMIN).send({
      phone: '081234567890',
      password: 'short',
    });
    expect(res.status).toBe(400);
    expect(res.body.fields?.some((f) => f.path === 'password')).toBe(true);
  });
});

describe('login', () => {
  it('returns a generic error for a malformed number — not a format hint', async () => {
    // A format-specific 400 would tell an attacker which inputs are real
    // numbers, turning the endpoint into a membership oracle.
    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: 'garbage', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Nomor atau kata sandi salah');
    expect(res.body.fields).toBeUndefined();
  });

  it('logout always succeeds and clears the cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie']?.join(';') ?? '';
    expect(cookie).toContain(`${COOKIE_NAME}=`);
    expect(cookie).toMatch(/HttpOnly/i);
  });
});

describe('session cookie hardening', () => {
  it('is httpOnly so XSS cannot read it', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
  });

  it('is SameSite=Lax to blunt CSRF', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.headers['set-cookie'][0]).toMatch(/SameSite=Lax/i);
  });
});

describe('malformed requests are client errors, not 500s', () => {
  it('rejects an oversized JSON body with 413', async () => {
    const big = { namaLengkap: 'x'.repeat(200_000), angkatan: 2015, whatsapp: '081234567890' };
    const res = await request(app).post('/api/alumni').send(big);
    expect(res.status).toBe(413);
    expect(res.body.error).toBeTruthy();
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/alumni')
      .set('Content-Type', 'application/json')
      .send('{"namaLengkap": broken');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('never leaks a stack trace to the client', async () => {
    const res = await request(app)
      .post('/api/alumni')
      .set('Content-Type', 'application/json')
      .send('{"broken');
    expect(JSON.stringify(res.body)).not.toMatch(/node_modules|at Layer|\.js:\d+/);
  });
});
