# IAKU Specs

Specification set for rebuilding the Alumni Kimia Unpad database app: Supabase →
Postgres, Tailwind → MUI, plus a UX redesign, a statistics rework, and a new job
board.

Target: **https://iaku.alvianzf.id**

## Read in order

| # | Doc | Covers |
|---|-----|--------|
| 01 | [architecture.md](./01-architecture.md) | Why a backend is now required, topology, repo layout |
| 02 | [database.md](./02-database.md) | Postgres schema, Prisma models, migration from Supabase |
| 03 | [auth.md](./03-auth.md) | Phone-number normalisation, login, sessions, roles |
| 04 | [api.md](./04-api.md) | REST endpoints, contracts, authorisation |
| 05 | [frontend.md](./05-frontend.md) | MUI migration, theme, squiggly background, Tailwind removal |
| 06 | [cicd.md](./06-cicd.md) | GitHub Actions → Ubuntu host, Cloudflare, TLS |
| 07 | [security.md](./07-security.md) | **Defects in the current app — read this one** |
| 08 | [ux-redesign.md](./08-ux-redesign.md) | Information architecture, page-by-page redesign |
| 09 | [statistics.md](./09-statistics.md) | Statistics page rework with charts (+ DB change) |
| 10 | [jobs.md](./10-jobs.md) | New job board, moderated |
| 11 | [mobile.md](./11-mobile.md) | Mobile-first rules and current breakages |

**If you read only one:** [07-security.md](./07-security.md). It documents a live
data exposure — public search responses carry unmasked names and phone numbers,
masked only in client-side JavaScript.

## Decisions already made

Settled in conversation; treated as fixed:

- **Backend:** Express + Prisma, in-repo under `/server`
- **Auth subjects:** alumni *and* admins (two roles)
- **Login:** normalised phone number + password (bcrypt), no OTP
- **UI:** full migration to MUI, Tailwind removed, `#FAF9F6` background
- **Background:** `@alvianzf/squiggly-lines-go-brrr`, used subtly
- **Hosting:** Ubuntu VPS behind Cloudflare, replacing Vercel

## The one thing to understand first

The app today is a browser-only SPA that talks to Supabase over HTTP. **A browser
cannot connect to Postgres** — it is a TCP wire protocol, not an HTTP API. So
"change the database" necessarily means building an API server and replacing
Supabase Auth. That single fact drives the scope of docs 01–04.

## Site is offline

The production site has been taken down for this rebuild. That relaxes real
constraints, and the specs assume it:

- **No zero-downtime requirement.** The `pm2 reload` and expand/contract
  migration guidance in [06](./06-cicd.md) becomes good practice for *future*
  deploys rather than a constraint on the cutover.
- **The migration can be destructive and re-run.** Take the dump, migrate,
  verify, repeat if wrong.
- **The P0 data exposure in [07](./07-security.md) is no longer live** — but the
  two exposed credentials still need rotating, and the exposure existed for as
  long as the site was up.

## Scope status

**These are specs. No implementation code has been written.** Each doc ends with
testable **Success criteria** — those are the acceptance tests.

Suggested build order, since the docs have dependencies:

1. **02 + 03** — schema and phone normalisation, with unit tests before the
   backfill touches data
2. **04** — API, which unblocks everything on the frontend
3. **05 + 08 + 11** — the UI rebuild; these three describe one pass, not three
4. **09** — statistics (needs the view change from 02)
5. **10** — job board (needs roles from 03)
6. **06** — deploy pipeline, which can be built in parallel from the start

## Credential handling

No spec contains a real credential; all appear as `<PLACEHOLDER>`. Real values
belong in `server/.env` (gitignored) and GitHub Actions secrets.

**Two credentials were pasted in plaintext during planning and must be rotated:**
the Postgres password and the Ubuntu host password. Tracked as P0 in
[07](./07-security.md).

## Open questions

Flagged in the docs; each needs an answer before the relevant piece is built:

- **Confirm the lower bound for `angkatan` validation** — the specs use 1957 as a
  placeholder for the founding year of the Kimia Unpad programme; I have not
  verified it ([02](./02-database.md#angkatan-is-an-integer--decided))
- Do any legacy rows have a NULL `angkatan`? Determines whether the column can be
  `NOT NULL`
- Is `pg_trgm` installable on the shared Postgres host?
  ([02](./02-database.md#indexes))
- What are the current Supabase RLS policies? Determines how severe the open
  signup actually was ([07](./07-security.md#p0--unauthenticated-account-creation))
- `ResultCard`'s contact button: intentional single-admin broker, or a leftover?
  ([08](./08-ux-redesign.md#result-card))
- `@mui/x-data-grid` for the admin table, or plain `Table`?
  ([05](./05-frontend.md#datagrid-is-a-judgement-call))
