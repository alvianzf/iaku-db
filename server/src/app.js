import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { env, isProduction } from './env.js';
import { attachUser } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { authRouter } from './routes/auth.js';
import { alumniRouter } from './routes/alumni.js';
import { statsRouter } from './routes/stats.js';
import { metaRouter } from './routes/meta.js';

/**
 * Express app, separated from the listener so tests can import it without
 * binding a port.
 *
 * Middleware order below is load-bearing, not stylistic.
 */
export function createApp() {
  const app = express();

  // Behind Cloudflare + nginx, req.ip would otherwise be the proxy's address,
  // collapsing every per-IP rate limit into one shared bucket. Trusting one hop
  // (nginx) is deliberate: `true` would trust the whole X-Forwarded-For chain,
  // which a client can forge. Safe only because the origin firewall restricts
  // 443 to Cloudflare ranges. See specs/06-cicd.md.
  app.set('trust proxy', 1);

  app.disable('x-powered-by');

  app.use(helmet());

  // credentials:true is required for the session cookie to be sent at all.
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));

  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));

  app.use(globalLimiter);
  app.use(attachUser);

  // Liveness only -- no DB round trip, so a database outage does not make the
  // deploy smoke test fail for the wrong reason.
  app.get('/api/health', (req, res) => {
    res.json({ ok: true, env: env.NODE_ENV });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/alumni', alumniRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/meta', metaRouter);

  app.use(notFound);

  // Must be last, and must keep 4 arguments -- Express identifies error
  // handlers by arity.
  app.use(errorHandler);

  return app;
}

export { isProduction };
