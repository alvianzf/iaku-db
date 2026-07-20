import 'dotenv/config';
import { z } from 'zod';

/**
 * Validated environment. Imported for side effects at startup so a
 * misconfigured server fails immediately and loudly, rather than at the first
 * request that happens to need the missing value.
 */

const schema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine((v) => v.startsWith('postgres://') || v.startsWith('postgresql://'), {
      message: 'DATABASE_URL must be a postgres:// or postgresql:// URL',
    }),

  // 32 bytes minimum. A short secret makes HS256 brute-forceable offline, and
  // forging a token means forging an admin session.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),

  // The single admin number the public contact-broker flow routes to.
  ADMIN_WHATSAPP: z.string().min(1).default('+6287894510004'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  console.error(`Invalid environment:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';

// A dev placeholder secret reaching production would mean every session token
// is forgeable by anyone who has read the repo.
if (isProduction && /dev-only|change-?me|placeholder|secret/i.test(env.JWT_SECRET)) {
  console.error('JWT_SECRET looks like a placeholder. Generate one: openssl rand -base64 48');
  process.exit(1);
}
