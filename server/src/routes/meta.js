import { Router } from 'express';
import { countryOptions } from '../lib/phone.js';
import { env } from '../env.js';

export const metaRouter = Router();

/**
 * GET /api/meta/countries — public.
 *
 * The country list for the phone selector. Served from here so the client does
 * not need libphonenumber's metadata (~150KB) just to render a dropdown, and so
 * the dial codes have one source of truth shared with server-side validation.
 */
const COUNTRIES = countryOptions();

metaRouter.get('/countries', (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.json(COUNTRIES);
});

/**
 * GET /api/meta/contact — public.
 *
 * The admin number the contact-broker flow routes to. Served rather than
 * hardcoded in a component, which is where it lived before.
 */
metaRouter.get('/contact', (req, res) => {
  res.json({ adminWhatsapp: env.ADMIN_WHATSAPP });
});
