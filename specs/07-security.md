# 07 — Security

Defects found while reading the current codebase, and how the migration
addresses each. Ordered by severity.

This doc exists because several of these are not migration work — they are live
issues in the deployed app today.

## P0 — Rotate the two exposed credentials

Both were transmitted in plaintext during planning and are now in a chat
transcript, and in whatever logs sit behind it.

| Credential | Action |
|---|---|
| Postgres user `ketoprak4248_alvianzf` | Change the password; update `/opt/iaku/shared/.env` |
| Ubuntu host `ubuntu@43.159.55.204` | Change the password; then disable password auth entirely per [06](./06-cicd.md) |

Rotate before launch, not after. Assume both are compromised.

While rotating, restrict Postgres network access: `103.94.238.99:65433` is
publicly routable, so the database is currently reachable by anyone on the
internet who guesses or obtains the password. Firewall it to the app server's IP
if the host allows it.

### P0 — The Postgres server refuses TLS

Confirmed by testing, not assumed:

```
sslmode=require -> "The server does not support SSL connections"
```

The app server (`43.159.55.204`) and the database (`103.94.238.99`) are on
different networks, so **every query crosses the public internet in cleartext** —
the database password on connect, and every alumni name and phone number in the
result sets. Anyone positioned on the path can read all of it.

`sslmode=require` cannot be set until the host enables TLS, so the connection
string in [02](./02-database.md) omits it and the topology diagram in
[01](./01-architecture.md) marks the link PLAINTEXT.

Ask the provider to enable TLS. Until then the only available mitigations are
IP-restricting the DB port and accepting the exposure knowingly. Do not let
`sslmode=require` sit in a config file where it silently falls back — if it is
added, verify it actually negotiates.

### Note — connections are currently rejected at the host level

Separate from the above, the database is refusing connections outright:

```
correct creds -> 28000 kamu tidak punya akses ke database ini
wrong password -> 28000 (identical)
nonexistent user -> 28000 (identical)
```

A nonexistent user and a wrong password produce the **byte-identical** error, so
the server is rejecting before evaluating credentials — `pg_hba.conf` or a proxy
doing host-based filtering, not a credential problem. Resending the password
cannot fix it; the connecting IP has to be allowlisted.

This is why the `Alumni` model in `schema.prisma` remains **unverified
inference** and must be reconciled with `db:pull` before any push.

## P0 — Unmasked data over the wire

`searchAlumni.js` does `select("*")`. `ResultCard.jsx` then calls `maskName()`
and `maskWhatsapp()` before rendering.

**The masking is cosmetic.** The full name and full WhatsApp number of every
matching alumnus are already in the browser — visible in the Network tab, in
`JSON.parse` of the response, or by deleting two function calls. Anyone who
opens devtools has the unredacted contact list. A short script iterating
two-letter search terms extracts the entire alumni database, phone numbers
included.

The masking UI signals an intended privacy guarantee — the contact button routes
through an admin (`wa.me/6287894510004`) rather than exposing the alumnus — so
this is a broken control, not an absent one.

**Fix:** masking moves server-side. `GET /api/alumni/search` selects only the
columns the public card renders and masks `nama_lengkap` / `whatsapp` **in the
API layer** before serialising. `src/utils/mask.js` moves to
`server/src/lib/mask.js`. The client receives data it is allowed to see and
nothing more.

Unmasked values remain available on admin routes, which check a real session.

This is the single most important change in the migration, and it is worth
treating as a disclosure question too: the data has been exposed for as long as
the app has been live.

## P0 — Unauthenticated account creation

`Dashboard.jsx` creates admins with `supabase.auth.signUp({ email, password })`.
The modal sits behind a session check, but `signUp` is a **public Supabase
endpoint** — it does not care that the UI is gated. Anyone with the anon key
(which is in the JS bundle, by design) can call it directly and create an
account.

Whether that account is useful depends entirely on Supabase RLS policies, which
are not in the repo and must be audited. If any policy grants access on
`authenticated` rather than a role claim, this is full admin compromise.

**Fix:** `POST /api/auth/users` requires an ADMIN session, verified server-side
([03](./03-auth.md#user-creation--post-apiauthusers--admin-only)). The first
admin is seeded by CLI, not through a UI.

## P1 — Authorisation enforced only in the client

`Dashboard.jsx` gates on `supabase.auth.getSession()` in a `useEffect` and
redirects if absent. Two problems:

1. **The redirect is not a guard.** `fetchData()` runs in a *separate*
   `useEffect` with no session dependency, so `getAllAlumni()` fires
   unconditionally on mount — before, and regardless of, the redirect.
2. **Client checks are advisory.** The real control is whatever RLS policy sits
   on `alumni_data`. If `select` is open to `anon` — which it must be, since
   the public search page is unauthenticated and uses the same table — then
   `getAllAlumni()` returns every row to anyone who calls it.

**Fix:** every rule is enforced in the API against the JWT
([04](./04-api.md)). The frontend hides controls a role cannot use, but hiding a
button is presentation, not authorisation.

## P1 — Search filter built by string concatenation

`searchAlumni.js:14-32` builds a PostgREST `.or()` filter by concatenating raw
user input:

```js
.or("nama_lengkap.ilike.%" + text + "%," + "perusahaan.ilike.%" + text + "%," + ...)
```

`,` and `)` are grammar characters in that filter syntax. Input containing them
alters the filter's structure rather than being matched literally — at minimum
producing errors or wrong results, and depending on how PostgREST parses the
malformed expression, potentially widening what is returned.

Not classic SQL injection — PostgREST parameterises the eventual query — but
untrusted input is shaping query *structure*, which is the same class of bug.

**Fix:** Prisma `OR` + `contains`
([04](./04-api.md#get-apialumnisearchqpagelimit)). Input becomes a bound
parameter and cannot influence structure.

## P1 — Session token in `localStorage`

Supabase's default persistence. Any XSS — including one introduced by a
compromised npm dependency — can read the token and exfiltrate a session.

**Fix:** httpOnly cookie ([03](./03-auth.md#sessions)), unreadable from JS.

Note the trade-off recorded there: httpOnly cookies close the XSS-exfiltration
path but introduce CSRF exposure, handled with `SameSite=Lax`.

## P2 — Unrestricted public writes

`POST` from `/form-alumni` is unauthenticated with no rate limit, captcha, or
moderation. Anyone can insert unlimited rows. Currently the only cost is
cleanup, but the table also feeds the public stats page, so injected rows
distort published figures.

**Fix:** 3/hour/IP ([04](./04-api.md#post-apialumni--public-submission)). A
moderation queue is the follow-up if spam materialises; not specced now because
no such concept exists today.

## P2 — Mass assignment on update

`Dashboard.jsx` sets `editData` to the **entire** alumnus object and sends it to
`updateAlumni(id, editData)`, which passes it straight to `.update()`. Every
column is writable by the client, including `id` and `created_at`, plus any
column added later — which is how this kind of bug reaches production long after
the code was written.

**Fix:** explicit field allowlist in the API
([04](./04-api.md#conventions)).

## P2 — Destructive delete with no confirmation

`onClick={() => handleDelete(a.id)}` — one click, immediate hard delete, no
dialog, no undo, no soft-delete column. The delete button sits directly beside
edit in a dense table.

**Fix:** confirmation dialog ([05](./05-frontend.md)), ADMIN-only
authorisation, and soft delete recommended
([04](./04-api.md#delete-apialumniid--admin-only)).

## Ongoing practice

- **Nothing secret in `VITE_`.** Every `VITE_`-prefixed var is compiled into the
  public bundle. This is why `VITE_SUPABASE_ANON_KEY` being public was fine
  (anon keys are designed to be) and why `DATABASE_URL` must never be one.
- **`.env` is gitignored**; verify before the first commit of `server/`.
- **`npm audit` in CI**, failing on high severity.
- **Dependency review.** `xlsx` has a history of prototype-pollution advisories
  and is used on admin-supplied data; check its advisory status during
  implementation.

## Success criteria

1. Both exposed credentials rotated; password SSH refused by the host.
2. Raw JSON of a public search contains no full phone number and no full name.
3. `POST /api/auth/users` without an ADMIN cookie returns 403.
4. `GET /api/alumni` without a session returns 401.
5. A search for `a,b)c` returns a normal response.
6. `document.cookie` does not expose the session token.
7. `grep -r "VITE_" src/` reveals nothing sensitive.
8. Port 3000 is unreachable from outside the host.
