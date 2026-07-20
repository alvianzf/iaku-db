import { PrismaClient } from '@prisma/client';
import { isProduction } from './env.js';

/**
 * Singleton PrismaClient.
 *
 * One instance per process: each `new PrismaClient()` opens its own connection
 * pool, and the database is on a shared host with a finite connection cap.
 * `node --watch` in dev re-imports modules on change, so the instance is
 * stashed on globalThis to survive reloads and avoid leaking pools.
 */

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__iakuPrisma ??
  new PrismaClient({
    log: isProduction ? ['warn', 'error'] : ['warn', 'error'],
  });

if (!isProduction) globalForPrisma.__iakuPrisma = prisma;

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
