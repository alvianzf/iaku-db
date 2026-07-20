# 03 — Authentication

Replaces Supabase Auth (`signInWithPassword`, `getSession`, `signUp`,
`signOut`), which disappears with Supabase.

Login identifier: **normalised phone number**. Proof: **password**.

## Why normalisation is the whole problem

Indonesian users write the same number many ways. All of these are one person:

```
0812-3456-7890      +62 812 3456 7890     62812 3456 7890
081234567890        +6281234567890        812-3456-7890
(0812) 34567890     0812 3456 7890        +62-812-3456-7890
```

Store them as typed and you get: duplicate accounts for one human, a login that
fails because the user typed a different-but-equivalent form than at signup, and
a `UNIQUE` constraint that enforces nothing. Normalisation converts a fuzzy
human string into a **canonical key** — one number, one representation, one row.

## Canonical form

**E.164**: `+`, country code, subscriber number. No spaces, dashes, or
parentheses. `+6281234567890`.

Stored in `users.phone_e164` and in `alumni_data.whatsapp`.

## Input model: country selector + national number

Users pick a country (default **Indonesia**) and type the number *without* the
country code:

```
[ 🇮🇩 +62 ▾ ]  [ 812 3456 7890        ]
```

This removes the ambiguity at the source rather than inferring it afterwards. A
number pasted in full international form (`+1 415 555 0123`) still parses, and
**the explicit country code wins over the selector** — so a paste is never
silently re-homed to the wrong country.

`normalizePhone(input, country)` takes the selected country as its second
argument, defaulting to `'ID'`.

## Algorithm

`server/src/lib/phone.js`, one exported function:

```
normalizePhone(input) -> string        // throws PhoneError on invalid
```

```
normalizePhone(input, country = 'ID') -> string   // throws PhoneError
tryNormalizePhone(input, country)      -> {ok:true,value} | {ok:false,reason}
countryOptions()                       -> [{code, dialCode}, …]
```

Steps, in order:

1. Reject non-string / empty → `PhoneError('empty')`; reject digit-free input →
   `no-digits`.
2. **Convert a leading `00` to `+`.** Must happen before parsing — see the
   library caveat below.
3. Reject an unknown country code → `unknown-country`.
4. Parse with `libphonenumber-js/max`, passing the selected country as the
   default region. Unparseable → `unrecognized-format`.
5. `isValid()` → else `invalid-number`. This subsumes the hand-rolled
   length and prefix checks, per country, from real metadata.
6. **Type check — the field is a WhatsApp number, so landlines are rejected.**
   Accept `MOBILE`; reject `FIXED_LINE` → `not-mobile`. Verified working across
   ID, GB, DE, AU, NL, SG, and IN — a Jakarta landline, a London landline, and
   so on are all correctly refused.

   `FIXED_LINE_OR_MOBILE` is also accepted, and this is **not** a loosening of
   the rule. Probing all major alumni destinations showed that **only the US and
   Canada** ever report it: the NANP assigns no mobile/landline distinction at
   the numbering-plan level, so it is not knowable from the number. Every other
   country returns a definite `MOBILE` or `FIXED_LINE`.

   So the choice in NANP is binary: accept the ambiguous type, or lock out every
   US and Canadian alumnus. It accepts. This is the one place a landline can slip
   through, and no library or rule can close it — the information does not exist
   in the number.
7. Return `parsed.number` — always E.164.

`tryNormalizePhone` is the non-throwing variant, used by the backfill (where a
failure is a row to record, not an exception) and by form validation.

### Reversed: `libphonenumber-js` is now used

**This spec originally argued against it** — ~150KB of per-country metadata for
a ~30-line, single-country rule set, with the note "revisit if international
alumni become a significant cohort." That condition was met: alumni live abroad,
and the UI now offers a country selector, so the hand-rolled Indonesian rules are
no longer sufficient.

Implemented in `server/src/lib/phone.js` against the **`libphonenumber-js/max`**
entrypoint, not the default. Two reasons, both found by probing rather than
assumed:

- The default (`min`) metadata **cannot report number type**, so it cannot tell
  a mobile from a landline. `getType()` returns undefined for every number.
- `min` wrongly reported `006281234567890` as **valid**, parsing it to
  `+62006281234567890`. `max` correctly rejects it.

Server-side the extra bytes are irrelevant. The frontend is a separate decision —
see [08](./08-ux-redesign.md#registration--daftar).

#### One thing the library gets wrong

`libphonenumber` does **not** strip the `00` international dial-out prefix when a
default country is supplied — it treats the digits as national and produces
`+62006281234567890`. `normalizePhone` converts a leading `00` to `+` before
parsing, so `0062...` pastes work rather than merely being rejected. There is a
regression test for this.

### Deliberate non-goals

- **No carrier or reachability check.** That is OTP's job, and OTP was
  explicitly ruled out.

### Unit tests — required before the backfill runs

The backfill rewrites production data, so the function must be proven first.
Table-driven over: all eight spellings above → identical output; `+1` US number
preserved; `+628` too short; `+62` landline rejected; empty/null/undefined;
non-breaking space; a string of letters; `00` international prefix.

## Backfill of `alumni_data.whatsapp`

Existing values are free text. Migration step 5 in [02](./02-database.md).

Script `server/scripts/normalize-phones.js`, run **after** a snapshot:

1. Read every `(id, whatsapp)`.
2. Normalise each. On `PhoneError`, do **not** guess and do **not** null the
   column — leave the value untouched and append to
   `reports/unparseable-phones.csv` (`id`, `nama_lengkap`, raw value, reason).
3. Detect collisions: two alumni normalising to the same E.164. These are
   duplicate people or a shared family number. **Do not merge automatically** —
   write to `reports/phone-collisions.csv` for human review.
4. Write successes in a single transaction.
5. Print `normalized / unparseable / collisions` counts.

Re-runnable: already-normalised values are idempotent under the function.

A non-zero unparseable count is expected and fine. Silently discarding those
rows would not be.

## Sessions

**JWT in an httpOnly cookie.**

```
Set-Cookie: iaku_session=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800
```

Payload: `{ sub: user.id, role, alumniId, iat, exp }`. HS256, secret from
`JWT_SECRET` (32+ random bytes). 7-day expiry.

- **httpOnly** — the token is unreadable from JavaScript, so an XSS bug cannot
  exfiltrate it. This is strictly better than the current setup, where Supabase
  keeps the session in `localStorage`.
- **SameSite=Lax** — blocks CSRF on state-changing cross-site requests while
  keeping normal top-level navigation working.
- **Secure** — HTTPS only. Requires TLS on the host (see 06).

### The trade-off, stated

Stateless JWTs **cannot be revoked before expiry**. Logout deletes the cookie
client-side, but a token already copied off the machine stays valid for up to 7
days. Accepted here because: the sensitive operations are admin-only and few,
the user base is small, and a session table means a DB round trip on every
request against a cross-host database.

If revocation becomes a requirement (an admin is compromised, or staff turnover
starts mattering), add a `sessions` table with a `revoked_at` column and check
it in the auth middleware — the cookie mechanics do not change.

Short expiry is not a substitute for revocation; it only shrinks the window.

## Roles

| Role | May |
|---|---|
| `ALUMNI` | Read public search; read and update **their own** alumni record |
| `ADMIN` | Everything, plus create/delete any record, export, create users |

Enforced **server-side** in `requireRole` / ownership checks. The frontend hides
what a role cannot use, but hiding a button is not authorisation — every rule is
re-checked in the API. This is the defect described in
[07-security.md](./07-security.md#client-side-authorisation).

Ownership rule: an `ALUMNI` may write `alumni_data` row R only if
`req.user.alumniId === R.id`. Never trust an `alumniId` from the request body.

## Flows

### Login — `POST /api/auth/login`

1. Body `{ phone, password }`, validated by zod.
2. `normalizePhone(phone)`. On `PhoneError` → **401, generic message**. Not 400:
   a format-specific error tells an attacker which inputs are valid numbers.
3. Look up by `phone_e164`.
4. **If no user is found, still run a bcrypt comparison against a dummy hash.**
   Otherwise the endpoint answers noticeably faster for unregistered numbers,
   which turns it into a membership oracle for the alumni list.
5. `bcrypt.compare`. Fail → 401.
6. Sign JWT, set cookie, update `last_login_at`, return
   `{ id, phone, role, alumniId }` — never the hash.

Failure response is always `401 { error: "Nomor atau kata sandi salah" }`,
identical for unknown number, wrong password, and malformed input.

**Rate limit: 5 attempts / 15 min per IP + phone.** Without it, password auth on
a public endpoint is brute-forceable, and phone numbers are a small, guessable
keyspace — far more so than emails.

### Logout — `POST /api/auth/logout`

Clear the cookie. Always 200.

### Current user — `GET /api/auth/me`

Returns the user, or 401. Replaces `supabase.auth.getSession()`. The frontend
calls this once on mount, since httpOnly cookies are not readable in JS.

### User creation — `POST /api/auth/users` — **ADMIN only**

The current Dashboard modal calls `supabase.auth.signUp()`, which is
unauthenticated by design — anyone could create an account. **That behaviour is
not carried over.** The replacement requires an ADMIN session.

Password policy: minimum 10 characters. Length beats composition rules; no
maximum below bcrypt's 72-byte input limit; reject the 100 most common
passwords.

### Self-registration — out of scope

The public `/form-alumni` page submits alumni *data*, not accounts. It does not
create a login. Linking a submission to an account is an admin action, and there
is no self-service password reset without OTP or email — an admin resets it.

State this to users on the login screen so they know who to contact.

## Success criteria

1. All eight spellings of one number log into the same account.
2. `normalizePhone` unit tests pass, including every rejection case.
3. Backfill leaves every row either valid E.164 or listed in a report file.
4. Login response time for an unknown number is statistically indistinguishable
   from a known number with a wrong password.
5. Six rapid failed logins return 429.
6. An `ALUMNI` token calling `DELETE /api/alumni/:id` gets 403, including when
   the id is their own.
7. `document.cookie` in the browser console does not show the session token.
