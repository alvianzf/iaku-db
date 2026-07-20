# 01 — Architecture

## The constraint that drives everything

The app today is a browser-only Vite SPA. It reaches its data by calling
Supabase from client JavaScript (`src/lib/supabase.js`), which works because
Supabase exposes **HTTP**. Postgres speaks a **binary TCP wire protocol** on
port 65433. A browser cannot open that socket — there is no fetch/XHR/WebSocket
path to it, and no library can work around this.

So "switch the database to Postgres" is not a swap of `src/lib/supabase.js`.
It necessarily means:

1. Building an API server that holds the Postgres connection, and
2. Replacing Supabase Auth, which disappears along with Supabase.

Both are new subsystems. This is the single largest fact about the migration
and the reason the scope is what it is.

### Corollary: the connection string must never reach the frontend

Anything under `src/` and any `VITE_`-prefixed env var is compiled into the
JavaScript bundle and served publicly. The Postgres URL belongs **only** to
the server process. See [07-security.md](./07-security.md).

## Target topology

```
Browser
  │  HTTPS, session cookie
  ▼
nginx  (43.159.55.204:443)
  ├── /            → static React build  (/var/www/iaku)
  └── /api/*       → proxy_pass 127.0.0.1:3000
                        │
                     Express API (pm2)
                        │  TCP, PLAINTEXT (server refuses TLS)
                        ▼
                     Postgres  103.94.238.99:65433
```

Postgres is on a different host from the app server. Two consequences:

- **Latency per query is a network round trip.** N+1 query patterns are much
  more expensive here than against a local DB. Prisma connection pooling is not
  optional.
- **The DB port is publicly routable, and the server refuses TLS.** Tested:
  `sslmode=require` fails with "The server does not support SSL connections", so
  queries and credentials cross the public internet in cleartext between two
  different hosts. Firewalling to the app server's IP is therefore the *only*
  control available. Escalated in 07.

## Repo layout

Monorepo, npm workspaces. Frontend stays where it is so its git history and
import paths survive.

```
iaku-db/
├── package.json          # workspace root; scripts delegate
├── src/                  # UNCHANGED LOCATION — React app
├── server/
│   ├── package.json
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── index.js          # express bootstrap
│       ├── env.js            # validated env, fails fast
│       ├── prisma.js         # singleton PrismaClient
│       ├── middleware/
│       │   ├── auth.js       # session → req.user
│       │   ├── requireRole.js
│       │   └── errorHandler.js
│       ├── routes/
│       │   ├── auth.js
│       │   ├── alumni.js
│       │   └── stats.js
│       └── lib/
│           ├── phone.js      # normalisation — see 03
│           └── mask.js       # server-side masking — see 07
├── specs/
└── .github/workflows/
```

**Why `server/` in-repo rather than a separate service:** one deploy artifact,
one version, no cross-repo contract drift. The API and the client that consumes
it change together in the same PR. Split it out later if the API gains other
consumers.

## Runtime choices

| Concern | Choice | Reason |
|---|---|---|
| Server | Express 4 | Team already writes JS; no build step |
| ORM | Prisma | The `?schema=public` suffix on the supplied URL is Prisma-specific syntax; typed models and `db push` schema sync come free |
| Sessions | JWT in httpOnly cookie | No session store to run; see 03 for the trade-off |
| Hashing | bcrypt, cost 12 | Standard, well-audited |
| Process mgr | pm2 | Restart-on-boot, log rotation, zero-downtime reload |
| Validation | zod | Already-familiar shape; used at every route boundary |

**Dependency justification** (per house rule: every dependency is permanent):
`express`, `@prisma/client`, `bcrypt`, `jsonwebtoken`, `zod`, `cookie-parser`,
`helmet`, `express-rate-limit`, `cors`, `dotenv`, and `libphonenumber-js`
(justified in 03 — it replaces hand-rolled per-country rules once the form gained
a country selector). No `axios` — the frontend already uses `fetch`.

`bcrypt` is pinned to **^6**: v5 pulls `node-pre-gyp` → `tar`, which carries
several path-traversal advisories, into the *production* tree. v6 uses
`node-gyp-build`. `npm audit --omit=dev` is clean.

## Local development

`vite.config.js` gains a dev proxy so the client calls `/api/*` in both dev and
prod with no environment branching in application code:

```js
server: { proxy: { '/api': 'http://localhost:3000' } }
```

Root scripts: `npm run dev` runs client and server concurrently; `npm run
build` builds the client. Schema sync is a deliberate manual step: `npm run db:push` from `server/` (see 02).

## What is deliberately NOT in scope

- Server-side rendering — the app is a search tool, SEO is not a goal
- Realtime/subscriptions — nothing in the current UI uses them
- File uploads / avatars — no such feature exists today
- Multi-tenancy — single organisation

## Success criteria

1. `npm run dev` at the repo root serves client on 5173 and API on 3000, and a
   search from the browser returns rows read from Postgres.
2. `grep -r "supabase" src/` returns nothing.
3. `grep -rE "postgres(ql)?://" dist/` after a production build returns nothing.
4. The API process is the only thing in the system holding a DB credential.
