import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { toPublicAlumni, PUBLIC_ALUMNI_SELECT } from '../lib/mask.js';
import { tryNormalizePhone } from '../lib/phone.js';
import { ApiError } from '../middleware/errorHandler.js';
import { requireAdmin, requireAlumniOwnershipOrAdmin } from '../middleware/requireRole.js';
import { requireAuth } from '../middleware/auth.js';
import { searchLimiter, submissionLimiter } from '../middleware/rateLimit.js';
import { refreshStats } from './stats.js';
import { phoneMessage } from '../lib/phoneMessages.js';

export const alumniRouter = Router();

const CURRENT_YEAR = new Date().getFullYear();
// Lower bound is a placeholder for the founding year of the Kimia Unpad
// programme and is NOT verified -- see specs/README.md open questions. Set too
// high, it silently rejects the oldest alumni.
const MIN_ANGKATAN = 1957;

const angkatanSchema = z.coerce
  .number()
  .int()
  .min(MIN_ANGKATAN, `Angkatan minimal ${MIN_ANGKATAN}`)
  .max(CURRENT_YEAR + 1, `Angkatan maksimal ${CURRENT_YEAR + 1}`);

/**
 * Text columns searched. `angkatan` is deliberately absent: it is an integer,
 * so the old `angkatan.ilike.%text%` clause could never have matched, and a
 * substring match on a year is wrong anyway ("201" would mean 2010-2019).
 */
const TEXT_SEARCH_FIELDS = [
  'namaLengkap',
  'perusahaan',
  'jabatan',
  'bidangPekerjaan',
  'subbidangPekerjaan',
  'domisiliKota',
  'domisiliProvinsi',
];

function buildSearchWhere(q) {
  const clauses = TEXT_SEARCH_FIELDS.map((f) => ({
    [f]: { contains: q, mode: 'insensitive' },
  }));

  // Exact year match, additive. The regex guards the cast: Number('abc') is
  // NaN, and NaN in a Prisma Int filter throws.
  if (/^\d{4}$/.test(q.trim())) {
    clauses.push({ angkatan: { equals: Number(q.trim()) } });
  }

  return { OR: clauses };
}

const searchQuerySchema = z.object({
  q: z.string().min(2, 'Ketik minimal 2 huruf').max(100),
  page: z.coerce.number().int().min(1).default(1),
  // Capped: `limit` reaches a Prisma `take`, and an uncapped value would let
  // anyone pull the whole table in one request.
  limit: z.coerce.number().int().min(1).max(100).default(12),
});

/**
 * GET /api/alumni/search — public, masked.
 *
 * The old implementation built a PostgREST filter by string concatenation, so a
 * `q` containing "," or ")" altered the filter's structure. Prisma's OR +
 * contains is parameterised: input cannot influence query structure.
 */
alumniRouter.get('/search', searchLimiter, async (req, res, next) => {
  try {
    const { q, page, limit } = searchQuerySchema.parse(req.query);
    const where = buildSearchWhere(q);

    const [rows, total] = await Promise.all([
      prisma.alumni.findMany({
        where,
        select: PUBLIC_ALUMNI_SELECT,
        orderBy: { namaLengkap: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.alumni.count({ where }),
    ]);

    res.json({
      data: rows.map(toPublicAlumni),
      page,
      totalResults: total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/alumni/count — public. Cached; the figure moves slowly. */
let countCache = { value: null, expiresAt: 0 };

alumniRouter.get('/count', async (req, res, next) => {
  try {
    const now = Date.now();
    if (countCache.value === null || countCache.expiresAt <= now) {
      countCache = {
        value: await prisma.alumni.count(),
        expiresAt: now + 6 * 60 * 60 * 1000,
      };
    }
    res.json({ total: countCache.value });
  } catch (err) {
    next(err);
  }
});

const alumniInputSchema = z.object({
  namaLengkap: z.string().trim().min(2, 'Nama wajib diisi').max(120),
  angkatan: angkatanSchema,
  whatsapp: z.string().trim().min(1, 'Nomor WhatsApp wajib diisi'),
  country: z.string().length(2).toUpperCase().default('ID'),
  // Optional: requiring all nine fields is why records are sparse or fake --
  // someone between jobs could not submit at all.
  perusahaan: z.string().trim().max(120).optional().or(z.literal('')),
  jabatan: z.string().trim().max(120).optional().or(z.literal('')),
  bidangPekerjaan: z.string().trim().max(120).optional().or(z.literal('')),
  subbidangPekerjaan: z.string().trim().max(120).optional().or(z.literal('')),
  domisiliProvinsi: z.string().trim().max(120).optional().or(z.literal('')),
  domisiliKota: z.string().trim().max(120).optional().or(z.literal('')),
});

const blank = (v) => (v === '' ? null : (v ?? null));

/**
 * POST /api/alumni — public submission, matching today's open /form-alumni.
 * Rate limited because nothing else stops a script from filling the table.
 */
alumniRouter.post('/', submissionLimiter, async (req, res, next) => {
  try {
    const input = alumniInputSchema.parse(req.body);

    // A form field the user can fix, so a specific error is correct here --
    // unlike login, where a specific error would be an oracle.
    const phone = tryNormalizePhone(input.whatsapp, input.country);
    if (!phone.ok) {
      throw new ApiError(400, 'Nomor WhatsApp tidak valid', [
        { path: 'whatsapp', message: phoneMessage(phone.reason) },
      ]);
    }

    const created = await prisma.alumni.create({
      data: {
        namaLengkap: input.namaLengkap,
        angkatan: input.angkatan,
        whatsapp: phone.value,
        perusahaan: blank(input.perusahaan),
        jabatan: blank(input.jabatan),
        bidangPekerjaan: blank(input.bidangPekerjaan),
        subbidangPekerjaan: blank(input.subbidangPekerjaan),
        domisiliProvinsi: blank(input.domisiliProvinsi),
        domisiliKota: blank(input.domisiliKota),
      },
      select: PUBLIC_ALUMNI_SELECT,
    });

    refreshStats();
    res.status(201).json(toPublicAlumni(created));
  } catch (err) {
    next(err);
  }
});


/* ---------------------------------------------------------------- admin ---- */

const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sort: z
    .enum(['namaLengkap', 'angkatan', 'perusahaan', 'domisiliKota', 'createdAt'])
    .default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * GET /api/alumni — ADMIN. Unmasked, paginated server-side.
 *
 * The old Dashboard loaded every row and paginated in the browser, which stops
 * working somewhere in the low thousands -- and now every row is a cross-host
 * transfer.
 */
alumniRouter.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { q, page, limit, sort, order } = listQuerySchema.parse(req.query);
    const where = q ? buildSearchWhere(q) : {};

    const [data, total] = await Promise.all([
      prisma.alumni.findMany({
        where,
        orderBy: { [sort]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.alumni.count({ where }),
    ]);

    res.json({ data, page, totalResults: total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

const updateSchema = alumniInputSchema.partial().omit({ country: true }).extend({
  country: z.string().length(2).toUpperCase().default('ID'),
});

/**
 * PATCH /api/alumni/:id — ADMIN, or an ALUMNI on their own record.
 *
 * Fields are picked explicitly. The old updateAlumni passed the entire edited
 * row object straight to .update(), so every column was client-writable --
 * including id, created_at, and any column added later.
 */
alumniRouter.patch('/:id', requireAuth, requireAlumniOwnershipOrAdmin, async (req, res, next) => {
  try {
    const input = updateSchema.parse(req.body);
    const data = {};

    if (input.namaLengkap !== undefined) data.namaLengkap = input.namaLengkap;
    if (input.angkatan !== undefined) data.angkatan = input.angkatan;
    for (const f of [
      'perusahaan',
      'jabatan',
      'bidangPekerjaan',
      'subbidangPekerjaan',
      'domisiliProvinsi',
      'domisiliKota',
    ]) {
      if (input[f] !== undefined) data[f] = blank(input[f]);
    }

    if (input.whatsapp !== undefined) {
      const phone = tryNormalizePhone(input.whatsapp, input.country);
      if (!phone.ok) {
        throw new ApiError(400, 'Nomor WhatsApp tidak valid', [
          { path: 'whatsapp', message: phoneMessage(phone.reason) },
        ]);
      }
      data.whatsapp = phone.value;
    }

    if (Object.keys(data).length === 0) {
      throw new ApiError(400, 'Tidak ada data yang diubah');
    }

    const updated = await prisma.alumni.update({ where: { id: req.params.id }, data });
    refreshStats();
    res.json(updated);
  } catch (err) {
    if (err?.code === 'P2025') return next(new ApiError(404, 'Alumni tidak ditemukan'));
    next(err);
  }
});

/**
 * DELETE /api/alumni/:id — ADMIN only.
 *
 * Alumni cannot delete their own record: deletion is irreversible and there is
 * no undo. The UI must confirm before calling this.
 */
alumniRouter.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await prisma.alumni.delete({ where: { id: req.params.id } });
    refreshStats();
    res.status(204).end();
  } catch (err) {
    if (err?.code === 'P2025') return next(new ApiError(404, 'Alumni tidak ditemukan'));
    next(err);
  }
});
