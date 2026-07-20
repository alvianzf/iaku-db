import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { tryNormalizePhone } from '../lib/phone.js';
import { ApiError } from '../middleware/errorHandler.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { requireAuth, signSession, setSessionCookie, clearSessionCookie } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireRole.js';
import { phoneMessage } from '../lib/phoneMessages.js';

export const authRouter = Router();

export const BCRYPT_ROUNDS = 12;

/**
 * A precomputed hash of a throwaway string, compared against when no user is
 * found so the endpoint takes the same time either way.
 *
 * Without it, an unregistered number returns noticeably faster than a
 * registered one with a wrong password, which turns login into a membership
 * oracle for the alumni list -- and phone numbers are a small, enumerable
 * keyspace.
 */
const DUMMY_HASH = bcrypt.hashSync('__no_such_user__', BCRYPT_ROUNDS);

const loginSchema = z.object({
  phone: z.string().trim().min(1),
  country: z.string().length(2).toUpperCase().default('ID'),
  password: z.string().min(1),
});

/**
 * Every login failure returns this exact response. Distinguishing "unknown
 * number" from "wrong password" -- or reporting a malformed number as 400 --
 * tells an attacker which inputs are real accounts.
 */
function invalidCredentials() {
  return new ApiError(401, 'Nomor atau kata sandi salah');
}

authRouter.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { phone, country, password } = loginSchema.parse(req.body);

    const normalized = tryNormalizePhone(phone, country);

    const user = normalized.ok
      ? await prisma.user.findUnique({ where: { phoneE164: normalized.value } })
      : null;

    // Runs even when the number is malformed or unknown, to keep timing flat.
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !ok) throw invalidCredentials();

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    setSessionCookie(res, signSession(user));

    res.json({
      id: user.id,
      phone: user.phoneE164,
      role: user.role,
      alumniId: user.alumniId,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
});

/**
 * GET /api/auth/me — replaces supabase.auth.getSession().
 * The session cookie is httpOnly, so the client cannot read it and must ask.
 */
authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, phoneE164: true, role: true, alumniId: true, lastLoginAt: true },
    });

    // The token verified but the row is gone -- a deleted account still
    // holding a valid cookie. Clear it rather than 500.
    if (!user) {
      clearSessionCookie(res);
      throw new ApiError(401, 'Sesi tidak valid');
    }

    res.json({ ...user, phone: user.phoneE164 });
  } catch (err) {
    next(err);
  }
});

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty123', 'iloveyou', 'admin123', 'welcome123', 'abc12345', 'passw0rd',
  'letmein123', 'iakuiaku', 'alumnikimia', 'kimiaunpad',
]);

const createUserSchema = z.object({
  phone: z.string().trim().min(1),
  country: z.string().length(2).toUpperCase().default('ID'),
  // Length beats composition rules. No maximum below bcrypt's 72-byte input
  // limit, which silently truncates beyond that.
  password: z.string().min(10, 'Kata sandi minimal 10 karakter').max(72),
  role: z.enum(['ALUMNI', 'ADMIN']).default('ALUMNI'),
  alumniId: z.string().uuid().optional(),
});

/**
 * POST /api/auth/users — ADMIN only.
 *
 * Replaces the Dashboard's supabase.auth.signUp() call, which was a PUBLIC
 * endpoint: the modal was gated by the UI, but the endpoint was not, so anyone
 * with the anon key could create an account.
 */
authRouter.post('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = createUserSchema.parse(req.body);

    const normalized = tryNormalizePhone(input.phone, input.country);
    if (!normalized.ok) {
      throw new ApiError(400, 'Nomor tidak valid', [
        { path: 'phone', message: phoneMessage(normalized.reason) },
      ]);
    }

    if (COMMON_PASSWORDS.has(input.password.toLowerCase())) {
      throw new ApiError(400, 'Kata sandi terlalu umum', [
        { path: 'password', message: 'Pilih kata sandi yang lebih sulit ditebak.' },
      ]);
    }

    const created = await prisma.user.create({
      data: {
        phoneE164: normalized.value,
        passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
        role: input.role,
        alumniId: input.alumniId ?? null,
      },
      select: { id: true, phoneE164: true, role: true, alumniId: true, createdAt: true },
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});
