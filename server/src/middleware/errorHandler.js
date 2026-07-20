import { ZodError } from 'zod';
import { isProduction } from '../env.js';

/**
 * Thrown by routes for expected, user-facing failures.
 * Anything else reaching the handler below is a bug.
 */
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

function clientErrorMessage(err, status) {
  if (err?.type === 'entity.too.large') return 'Data yang dikirim terlalu besar';
  if (err?.type === 'entity.parse.failed') return 'Format data tidak valid';
  return status === 413 ? 'Data yang dikirim terlalu besar' : 'Permintaan tidak valid';
}

export function notFound(_req, res) {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
}

/**
 * Must be registered LAST, after all routes, and must keep its 4-arity
 * signature -- Express identifies error handlers by argument count, so
 * dropping `next` silently turns this into a normal middleware that never runs.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Data yang dikirim tidak valid',
      fields: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: err.message,
      ...(err.details ? { fields: err.details } : {}),
    });
  }

  // Prisma's known-request errors carry a code; P2002 is a unique violation,
  // which is a client problem rather than a server fault.
  if (err?.code === 'P2002') {
    return res.status(409).json({ error: 'Data sudah terdaftar' });
  }

  // body-parser (and anything else using the http-errors convention) attaches
  // a status. These are client faults -- an oversized body or malformed JSON --
  // so they must not become a 500 with a logged stack trace.
  const status = err?.status ?? err?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return res.status(status).json({ error: clientErrorMessage(err, status) });
  }

  // Anything past here is unexpected. Log the detail server-side; never send
  // stack traces or Prisma internals to the client -- they disclose schema and
  // file paths.
  console.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Terjadi kesalahan pada server',
    ...(isProduction ? {} : { debug: err?.message }),
  });
}
