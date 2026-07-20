import { Router } from 'express';
import { prisma } from '../prisma.js';

export const statsRouter = Router();

/**
 * Aggregate statistics.
 *
 * Specs 02/09 called for a materialized view. That was written assuming
 * `prisma migrate`; with `db push` there is no migration file to carry the
 * CREATE MATERIALIZED VIEW, and Prisma does not model views -- so it would mean
 * a hand-applied SQL file that nothing keeps in sync with the schema.
 *
 * groupBy computes the same numbers with no extra database object to maintain.
 * The cost is six queries instead of one read, which the cache below absorbs:
 * the figures move only when an alumnus is added or edited, and both paths call
 * refreshStats().
 *
 * If the table grows enough that a cold cache is slow, revisit the view.
 */

const CATEGORIES = [
  { key: 'domisili_provinsi', field: 'domisiliProvinsi' },
  { key: 'domisili_kota', field: 'domisiliKota' },
  { key: 'bidang_pekerjaan', field: 'bidangPekerjaan' },
  { key: 'perusahaan', field: 'perusahaan' },
  { key: 'jabatan', field: 'jabatan' },
  { key: 'angkatan', field: 'angkatan' },
];

let cache = { data: null, expiresAt: 0 };
const TTL_MS = 60 * 60 * 1000;

/** Invalidate after any alumni write. */
export function refreshStats() {
  cache = { data: null, expiresAt: 0 };
}

async function computeStats() {
  const results = await Promise.all(
    CATEGORIES.map(async ({ key, field }) => {
      const grouped = await prisma.alumni.groupBy({
        by: [field],
        _count: { _all: true },
        where: { NOT: { [field]: null } },
      });

      return grouped
        .filter((row) => {
          const v = row[field];
          // Empty strings are as useless as NULLs here -- they render as a
          // chart category with a blank label.
          return v !== null && v !== undefined && String(v).trim() !== '';
        })
        .map((row) => ({
          category: key,
          // Serialised as text so every category shares one shape. `angkatan`
          // is an integer, so the client must sort it numerically, not
          // lexicographically. See specs/09-statistics.md.
          value: String(row[field]),
          count: row._count._all,
        }));
    })
  );

  return results.flat().sort((a, b) => b.count - a.count);
}

/** GET /api/stats — public. Aggregate only; no personal fields. */
statsRouter.get('/', async (req, res, next) => {
  try {
    const now = Date.now();
    if (!cache.data || cache.expiresAt <= now) {
      cache = { data: await computeStats(), expiresAt: now + TTL_MS };
    }
    res.json(cache.data);
  } catch (err) {
    next(err);
  }
});
