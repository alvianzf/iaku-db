# 04 — API

Base path `/api`. JSON in, JSON out. Session via httpOnly cookie (see 03).

## Conventions

- **Validation at every boundary.** Every route parses `body`/`query` with zod
  before touching Prisma. A route that reads `req.body.x` directly is a bug.
- **Errors** are `{ error: string }` with a user-facing Indonesian message. Stack
  traces and Prisma error text never cross the wire — they go to server logs.
- **No mass assignment.** Write routes pick fields explicitly. Spreading
  `req.body` into a Prisma `update` lets a caller set `id`, `created_at`, or any
  column added later. `Dashboard.jsx` currently sends the entire row object back
  on save, so this is a live hazard, not a hypothetical.
- **Pagination** is `{ data, page, totalResults, totalPages }` — matching what
  `searchAlumni.js` already returns, so the frontend contract is unchanged.

## Public

### `GET /api/alumni/search?q=&page=&limit=`

Replaces `searchAlumni()`.

`q` min length 2 (existing behaviour), `limit` default 12, **max 100**. The cap
matters: `limit` reaches a `take` clause, and an uncapped value lets anyone
request the entire table in one call.

The current implementation builds a PostgREST `.or()` filter by string
concatenation:

```js
.or("nama_lengkap.ilike.%" + text + "%," + ...)
```

A `q` containing `,` or `)` breaks out of the intended filter grammar. The
Prisma replacement uses parameterised `OR` + `contains` with
`mode: 'insensitive'`, which cannot be escaped by input:

```js
const TEXT_FIELDS = [
  'nama_lengkap', 'perusahaan', 'jabatan', 'bidang_pekerjaan',
  'subbidang_pekerjaan', 'domisili_kota', 'domisili_provinsi',
];

const clauses = TEXT_FIELDS.map((f) => ({ [f]: { contains: q, mode: 'insensitive' } }));

// angkatan is an integer — equality, not substring
if (/^\d{4}$/.test(q.trim())) {
  clauses.push({ angkatan: { equals: Number(q.trim()) } });
}

where: { OR: clauses }
```

### Why `angkatan` is handled separately

It is an `integer` ([02](./02-database.md#angkatan-is-an-integer--decided)),
so the current `angkatan.ilike.%text%` clause has been **broken since it was
written** — `ilike` is a text operator and cannot apply to an integer column.
Searching by year has never worked. This is the fix.

Design choices in that branch:

- **Exact match only, on a 4-digit query.** A year is not a substring — matching
  `201` against 2010–2019 would mean typing three digits returns a decade, which
  is not what anyone intends.
- **The regex guards the cast.** `Number("abc")` is `NaN`, and passing `NaN` into
  a Prisma `equals` on an `Int` throws. Any query that is not exactly four digits
  simply skips this clause and searches text only.
- **It is additive, inside the same `OR`.** Searching `2015` still matches a
  company named "2015 Corp" through the text clauses. No behaviour is lost.

Range search ("alumni 2010–2015") is a filter, not free-text search — it belongs
as an explicit query parameter if wanted, not inferred from the search box.

**Responses are masked.** See [07](./07-security.md#unmasked-data-over-the-wire)
— masking moves from the client to here.

### `GET /api/alumni/count`

Replaces `getTotalAlumni()`. Cached 6h in-process, matching the current client
cache.

### `GET /api/stats`

Replaces `getAlumniStats()`. Reads the `alumni_stats` materialized view, ordered
by count desc. Public, unmasked — it is aggregate data with no personal fields.

### `POST /api/alumni` — public submission

Replaces `addAlumni()` from `Form.jsx`.

This endpoint is **public and unauthenticated**, matching today's behaviour: the
`/form-alumni` page is open to anyone. That is intentional for a self-service
alumni registry, but it means anyone on the internet can insert rows. Required
controls:

- **Rate limit: 3 submissions / hour / IP.** Nothing today prevents a script
  from filling the table.
- `whatsapp` is run through `normalizePhone`; a `PhoneError` returns 400 with a
  field-level message. This is the one place a specific validation error is
  correct — it is a form, and the user needs to know what to fix.
- All nine fields validated for length and type.
- Submissions land with `status: 'pending'` **if** a moderation flow is wanted.
  Not specced here because no such concept exists today; flagged as the obvious
  follow-up if spam appears.

## Authenticated

`POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` — see
[03](./03-auth.md).

### `GET /api/alumni` — ADMIN

Replaces `getAllAlumni()`, which `Dashboard.jsx` calls to load **every row at
once** and then paginates in the browser. That works at current scale and stops
working somewhere in the low thousands.

The endpoint therefore takes `page`/`limit`/`sort`/`q` and paginates
server-side. The Dashboard's client-side filtering and sorting move to the
server with it. This is why `DataGrid` in [05](./05-frontend.md) should be
configured in server-side mode.

Returns **unmasked** data — admins need real phone numbers.

### `GET /api/alumni/export` — ADMIN

`Dashboard.jsx` builds the XLSX in-browser from the full dataset. With
server-side pagination that data is no longer in the client, so export becomes
an endpoint that streams the file.

Logged: who exported, when, how many rows. A full dump of every alumnus's
contact details is the single most sensitive operation in the system.

### `PATCH /api/alumni/:id` — ADMIN, or ALUMNI on own record

Replaces `updateAlumni()`.

Authorisation: `role === 'ADMIN'`, or `req.user.alumniId === req.params.id`.
Checked against the **token**, never a body field.

Editable fields are an explicit allowlist. `whatsapp` is re-normalised; a change
that collides with an existing `phone_e164` returns 409 rather than silently
creating a duplicate identity.

Any successful write triggers `REFRESH MATERIALIZED VIEW CONCURRENTLY
alumni_stats`.

### `DELETE /api/alumni/:id` — ADMIN only

Replaces `deleteAlumni()`. Alumni cannot delete their own record — deletion is
irreversible and there is no undo UI.

Consider a soft delete (`deleted_at`) instead. The current hard delete is one
misclick from unrecoverable data loss, and the Dashboard fires it with **no
confirmation dialog** (`onClick={() => handleDelete(a.id)}`). At minimum, add
the confirm dialog in 05.

### `POST /api/auth/users` — ADMIN only

Replaces the Dashboard's `supabase.auth.signUp()` call. See
[03](./03-auth.md#user-creation--post-apiauthusers--admin-only) — the current
version is unauthenticated and that is not carried over.

## Rate limits

| Route | Limit |
|---|---|
| `POST /api/auth/login` | 5 / 15 min per IP+phone |
| `POST /api/alumni` | 3 / hour per IP |
| `GET /api/alumni/search` | 60 / min per IP |
| everything else | 300 / min per IP |

All keyed on the **real client IP**, which behind Cloudflare is not
`req.ip` — see [06](./06-cicd.md#trust-proxy-or-rate-limiting-silently-breaks).

## Middleware order

Order is load-bearing; this is not arbitrary.

```
helmet
cors({ origin: 'https://iaku.alvianzf.id', credentials: true })
cookieParser
express.json({ limit: '100kb' })
rateLimit
router
errorHandler          ← last, 4-arity
```

`credentials: true` on CORS is required for the session cookie. `errorHandler`
must be registered after the routes or Express will not route errors to it.

## Success criteria

1. `q=a,b)c` returns results or empty — never a 500, never a malformed query.
2. `limit=99999` returns at most 100 rows.
3. An unauthenticated `GET /api/alumni` returns 401; an `ALUMNI` token gets 403.
4. `PATCH` with `{"id":"other-uuid","role":"ADMIN"}` in the body changes neither.
5. A public search response contains no unmasked phone number, verified by
   reading the raw JSON in the network tab.
6. Every route has a zod schema; a route without one fails review.
