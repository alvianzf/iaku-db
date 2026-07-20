import { createApp } from './app.js';
import { env } from './env.js';
import { disconnectPrisma } from './prisma.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`iaku-api listening on :${env.PORT} (${env.NODE_ENV})`);
});

/**
 * Graceful shutdown: pm2 reload sends SIGINT/SIGTERM, and without this the
 * process is killed mid-request and leaks its Prisma connection pool against a
 * database with a finite connection cap.
 */
async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
  // Don't hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
