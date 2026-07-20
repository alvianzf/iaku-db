# 02 — Database

## Connection

```
DATABASE_URL="postgresql://<USER>:<PASSWORD>@103.94.238.99:65433/ketoprak4248_iaku?schema=public&sslmode=require&connection_limit=10"
```

Lives in `server/.env`, gitignored, never `VITE_`-prefixed.

Two additions to the supplied string, both deliberate:

- **`sslmode=require`** — the DB is on a public IP on a different host from the
  app. Without this, credentials and every alumni record (including phone
  numbers) cross the open internet in cleartext. If the server rejects TLS,
  that is a blocker to resolve with the host, not a reason to drop the flag.
- **`connection_limit=10`** — Prisma defaults to `num_cpus * 2 + 1`, which on a
  multi-core box can exceed shared-hosting connection caps. 10 is a starting
  point; tune against the plan's actual limit.

## Current schema, as inferred

There is no schema file in the repo — the tables live in Supabase and the shape
below is reconstructed from field usage across `src/pages/Form.jsx`,
`src/pages/admin/Dashboard.jsx`, `src/components/database/ResultCard.jsx`, and
the `.or()` filter in `src/lib/searchAlumni.js`.

**This reconstruction must be verified against the live database before
migrating** — `\d alumni_data` in psql. Nullability and exact types are the
parts most likely to be wrong.

### `alumni_data`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid / bigint | PK. Confirm which — Supabase defaults to uuid |
| `created_at` | timestamptz | Sorted on in Dashboard |
| `nama_lengkap` | text | |
| `angkatan` | integer | Entry year — **decided**, see below |
| `perusahaan` | text | |
| `jabatan` | text | |
| `bidang_pekerjaan` | text | |
| `subbidang_pekerjaan` | text | |
| `whatsapp` | text | Free-form today; normalised by this migration |
| `domisili_provinsi` | text | |
| `domisili_kota` | text | |

#### `angkatan` is an integer — decided

`angkatan` is the entry **year**, stored as `integer`.

```prisma
angkatan Int
```

This resolves a conflict in the current code: `Form.jsx:17` submits it as
`type: "number"`, while `searchAlumni.js:24` filters it with
`angkatan.ilike.%text%` — `ilike` is a text operator. Against an integer column
that clause has been **failing or silently matching nothing since it was
written**. Nobody has been able to search by year.

Three consequences run through the rest of the specs:

1. **Search needs a numeric branch,** not a substring match
   ([04](./04-api.md#get-apialumnisearchqpagelimit)).
2. **Every place `angkatan` is concatenated or unioned with text needs an
   explicit `::text` cast** — the trigram index below and the stats view. Without
   the cast Postgres raises a type error and the migration fails outright, which
   is at least a loud failure rather than a quiet one.
3. **Sorting becomes correct by construction.** A text column sorts
   lexicographically, which happens to work for uniform 4-digit years but breaks
   on any stray value; integer ordering is genuinely chronological
   ([09](./09-statistics.md)).

**Validation range:** reject values outside `1957 … currentYear + 1`. The upper
bound allows for students entering next intake; the lower bound needs your
confirmation — it should be the founding year of the Kimia Unpad programme, and
I have not verified it. Anything outside the range is a typo (a phone number or
a graduation year pasted into the wrong field), not a cohort.

**Nullability:** required in the form today. Confirm whether legacy rows have
NULL `angkatan` before adding `NOT NULL`.

### `alumni_stats`

Read by `getAlumniStats.js` with columns `category`, `value`, `count`, ordered
by count desc. Categories in use: `domisili_provinsi`, `domisili_kota`,
`bidang_pekerjaan`.

This is an aggregate over `alumni_data`, so it becomes a **materialized view**
rather than a Prisma model — no application code writes to it:

```sql
CREATE MATERIALIZED VIEW alumni_stats AS
  SELECT 'domisili_provinsi' AS category, domisili_provinsi AS value, COUNT(*)::int
    FROM alumni_data WHERE domisili_provinsi <> '' GROUP BY 1,2
  UNION ALL
  SELECT 'domisili_kota', domisili_kota, COUNT(*)::int
    FROM alumni_data WHERE domisili_kota <> '' GROUP BY 1,2
  UNION ALL
  SELECT 'bidang_pekerjaan', bidang_pekerjaan, COUNT(*)::int
    FROM alumni_data WHERE bidang_pekerjaan <> '' GROUP BY 1,2;

CREATE UNIQUE INDEX alumni_stats_pk ON alumni_stats (category, value);
```

Refreshed `CONCURRENTLY` (hence the unique index) after any alumni write, and
by a nightly cron as a backstop. The client already caches stats for 24h in
sessionStorage, so staleness of minutes is invisible to users.

## New tables

### `users`

New — Supabase Auth owned this and it goes away.

```prisma
model User {
  id           String   @id @default(uuid())
  phoneE164    String   @unique @map("phone_e164")
  passwordHash String   @map("password_hash")
  role         Role     @default(ALUMNI)
  alumniId     String?  @unique @map("alumni_id")
  alumni       Alumni?  @relation(fields: [alumniId], references: [id], onDelete: SetNull)
  createdAt    DateTime @default(now()) @map("created_at")
  lastLoginAt  DateTime? @map("last_login_at")

  @@map("users")
}

enum Role { ALUMNI ADMIN }
```

- `phoneE164` is the login identifier, always normalised (see 03). Unique — this
  constraint is what makes normalisation load-bearing rather than cosmetic.
- `alumniId` links a login to the alumni record it may edit. Nullable because an
  admin need not be an alumnus. `SetNull` on delete so removing an alumni record
  does not silently delete the account.
- **No `email` column.** Email is not part of the auth story.

### `sessions` — deliberately omitted

JWT-in-cookie means no session table. Trade-off stated plainly in 03.

## Indexes

The search in `searchAlumni.js` ORs `ILIKE %term%` across eight columns. A
leading wildcard defeats a B-tree index entirely, so today every search is a
sequential scan. That is survivable at a few thousand rows and degrades badly
beyond that — especially now that each query is a cross-host round trip.

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX alumni_search_trgm ON alumni_data USING GIN (
  (COALESCE(nama_lengkap,'')        || ' ' || COALESCE(perusahaan,'')       || ' ' ||
   COALESCE(jabatan,'')             || ' ' || COALESCE(bidang_pekerjaan,'') || ' ' ||
   COALESCE(subbidang_pekerjaan,'') || ' ' || COALESCE(domisili_kota,'')    || ' ' ||
   COALESCE(domisili_provinsi,''))
  gin_trgm_ops
);

CREATE INDEX alumni_angkatan ON alumni_data (angkatan);

CREATE INDEX alumni_created_at ON alumni_data (created_at DESC);
```

`pg_trgm` makes `ILIKE '%term%'` index-assisted. Requires the extension to be
installable on the shared host — **verify before relying on it**; if it is not
available, fall back to a `tsvector` column with a trigger, which handles
prefix/word matching but not true substring.

Two details in that expression are load-bearing:

- **`angkatan` is deliberately excluded.** It is an integer, so it cannot join a
  text concatenation without a cast — and a trigram index over a year is close to
  useless anyway (`201` would match 2010–2019 as a substring, which is not what
  anyone means). Year search gets its own plain B-tree index and an equality
  branch in the query.
- **`COALESCE` on every column.** `||` yields NULL if *any* operand is NULL, so a
  single NULL column would blank the entire indexed string for that row and make
  it unsearchable by every other field. This is a quiet, total failure — the row
  simply never appears in results.

## Schema management: `db push`, not migrations

**Decision: `prisma db push`.** No `migrations/` directory, no migration history.

Reasonable here because the target is greenfield and the site is offline — there
is no production history to preserve and no incremental upgrade path to replay.
It also removes a whole class of deploy failure (a half-applied migration).

What is given up, stated so it is a choice rather than an accident:

- **No rollback artifact.** There is no `down` step and no record of what
  changed. The database dump *is* the rollback.
- **No reproducible schema history.** `schema.prisma` at a given commit is the
  only record of what the schema was.
- **`db push` can drop data.** When the schema disagrees with the live table,
  push resolves it by altering the table — dropping a column it does not know
  about, or narrowing a type. Prisma refuses destructive changes without
  `--accept-data-loss`, so **never pass that flag reflexively**; read what it is
  about to drop.

Because of that last point, the order below matters: pull first, reconcile, then
push. Pushing an unverified schema at a populated table is exactly how columns
disappear.

If the project later needs auditable schema changes against live data, switch to
`prisma migrate` — `db push` is the right call for the rebuild, not forever.

## Migration from Supabase

1. **Inspect.** `npm run db:pull` against the target, and `\d alumni_data` on
   Supabase. Reconcile `schema.prisma` with what actually exists. **The Alumni
   model is currently unverified inference** — this step is what makes it real.
2. **Export.** `pg_dump --data-only --table=alumni_data` from Supabase. Keep the
   dump; it is the rollback.
3. **Push.** `npm run db:push` against the target.
4. **Load.** Restore the data dump.
5. **Normalise phone numbers.** The backfill in 03. This is the first
   destructive step — it rewrites `whatsapp` in place. Snapshot first.
6. **Seed the first admin.** A CLI script, not a UI (see 07 — the current
   signup UI is an open endpoint and is not being carried over).
7. **Build stats view + indexes.**
8. **Verify.** Row counts match the dump; a known alumnus is findable by each
   of the eight search fields; stats totals equal `COUNT(*)`.

Steps 5–7 are idempotent and safe to re-run.

## Success criteria

1. `SELECT COUNT(*) FROM alumni_data` equals the Supabase count exactly.
2. Every `whatsapp` value matches `^\+[1-9][0-9]{7,14}$`, or is recorded in the
   unparseable report from 03 — no silent data loss.
3. `EXPLAIN ANALYZE` on a representative search shows an index scan, not a
   sequential scan.
4. `users` contains exactly one ADMIN row after seeding.
5. Refreshing `alumni_stats` after inserting one alumnus increments the matching
   category counts by exactly 1.
