# 08 — UX Redesign

"Make it user friendly and make sense." This doc is the information-architecture
and interaction pass; [05](./05-frontend.md) is the mechanical MUI port. Read
this one first — it decides *what* the pages are, 05 decides what they are built
from.

## What the app is actually for

Reading the code, the product has three distinct audiences that the current
design does not distinguish:

| Who | Wants | Today |
|---|---|---|
| Someone looking for an alumnus | Find a person, then make contact | Search works; contact is a dead end |
| An alumnus | Be listed, keep their entry current | Can submit once; can never edit |
| The admin | Curate data, answer contact requests | A dense table |

The central tension: **results are deliberately masked** (`maskName`,
`maskWhatsapp`), so a search never actually answers "who is this and how do I
reach them." Every successful search ends at a button that messages one hardcoded
admin number. The privacy stance is defensible, but the UI presents itself as a
directory and then withholds the directory, which is the main reason it feels
like it doesn't make sense.

**The redesign commits to that stance instead of hiding it:** this is a
*contact-brokering* service, not a phone book. Say so, and make the brokered
request a first-class flow rather than a disabled-looking button.

## Navigation

Current: `Home · Statistik · Form Alumni · [shield icon]` at `text-2xl` with
`space-x-10`.

Problems:

- **It overflows on mobile.** Three 24px labels plus a button on a 375px viewport
  do not fit; there is no responsive treatment anywhere in `Layout.jsx`.
- **"Form Alumni" is jargon.** It names an implementation artifact (a form), not
  a user goal.
- **The shield icon is unlabeled.** Users cannot tell what it does; admins don't
  need it in the public nav at all.

Redesign:

| Label | Path | Note |
|---|---|---|
| Cari Alumni | `/` | Names the actual job |
| Lowongan | `/lowongan` | New — see [10](./10-jobs.md) |
| Statistik | `/statistik` | Renamed from `/stats` for consistency |
| Daftar / Perbarui Data | `/daftar` | Renamed from `/form-alumni` |
| — | `/masuk` | **Removed from the nav.** Admin login is a footer link |

`AppBar` with a `Drawer` hamburger below the `md` breakpoint. Logo shrinks to
40px in the bar — the current 64px nav logo plus a **320px** logo on the home
page is the single biggest layout problem in the app.

Paths move to Indonesian to match the UI language, which is entirely Indonesian
today. Old paths (`/stats`, `/form-alumni`, `/auth`) get redirects so existing
links survive.

## Home — the search page

The current page stacks: 320px logo → 5xl headline → subtitle → search field.
On a laptop the search box, which is the entire purpose of the page, starts
around 600px down. On a phone it is well below the fold.

Redesign, top to bottom:

1. **Search field first**, immediately under the AppBar, full width, autofocused.
   Logo drops to ~96px and sits beside the headline rather than above it.
2. **Headline shrinks** to `h4`, one line: "Database Alumni Kimia Unpad."
3. **A one-line explanation of the privacy model, always visible** — not a
   tooltip: *"Nama dan nomor ditampilkan sebagian. Untuk terhubung, kirim
   permintaan lewat pengurus."* This is what makes the masked results make sense.
4. **Result count** — "12 alumni ditemukan" — before the cards.
5. **Results grid**, then pagination.

### Search behaviour

`onSearch` currently fires on **every keystroke** (`onChange={(e) =>
onSearch(e.target.value)}`), so typing "kimia" is five full round trips — now
cross-host round trips. Add a **300ms debounce**. This is a real cost increase
under the new architecture, not a nicety.

Also fix the three states the page currently handles poorly:

- **Idle** (no query): today a bare gray sentence. Replace with suggested
  searches — a few common `bidang_pekerjaan` values as clickable chips — so the
  empty page teaches what is searchable.
- **Loading:** the spinner never appears due to the `setLoading` ordering bug
  ([05](./05-frontend.md#bugs-to-fix-during-migration)). Fix it, and show 6
  `Skeleton` cards rather than a spinner, so the layout does not jump.
- **No results:** say what was tried and offer a way out — "Tidak ada hasil untuk
  *X*. Coba nama, perusahaan, atau kota." Today it is one gray line.
- **Error:** there is **no error state at all** — `searchAlumni` catches, logs to
  console, and returns an empty array, so a failed request is indistinguishable
  from "no alumni found." Users get told there is nobody by that name when the
  server is actually down. Add a distinct error state with a retry action.

## Result card

Current issues, all visible in `ResultCard.jsx`:

- Every field renders `"N/A"` when empty, so a sparse record is a wall of N/A.
  **Omit empty fields** instead.
- The masked WhatsApp (`maskWhatsapp` → `08**********`) conveys nothing — it is
  the same shape for everyone. **Drop it from the card entirely.** Its only
  function is to signal "we have a number," which the contact button already says.
- The contact button is `disabled={!whatsapp}` but always opens a chat to the
  *same admin number* regardless of which alumnus is shown. So it is disabled
  based on data it does not use. Either it was meant to message the alumnus (a
  privacy reversal) or the `disabled` is a leftover. **Resolve to: always
  enabled, and prefill the message with the alumnus's masked name and angkatan**
  so the admin knows who is being asked about:

  > "Halo, saya ingin terhubung dengan **Al\*\*\*\* S\*\*\*\* (Angkatan 2015)**."

  That single change turns the dead end into a working request, and it is the
  highest-value fix on the page.

- **Hardcoded admin number** (`6287894510004`) sits in a component. Move it to
  config — a phone number in JSX is a maintenance trap.

Card body becomes: masked name + angkatan (header), then jabatan @ perusahaan,
bidang, kota — each omitted if empty — then the contact button.

## Registration → `/daftar`

Nine fields, all `required`, in a flat stack. `whatsapp` is a free-text `tel`
input with no validation, which is why the data needs the normalisation backfill
in [03](./03-auth.md).

Redesign:

- **Group the fields** into Pribadi (nama, angkatan), Pekerjaan (perusahaan,
  jabatan, bidang, subbidang), Kontak & Domisili (whatsapp, provinsi, kota).
  Three labeled sections, not nine anonymous boxes.
- **Relax `required`.** All nine mandatory is why records are sparse or fake —
  someone between jobs cannot submit. Require nama, angkatan, whatsapp. The rest
  optional.
- **Phone becomes a country selector + national-number field**
  ([03](./03-auth.md#input-model-country-selector--national-number)), defaulting
  to Indonesia. The user types `812 3456 7890`, not a country code.

  **Bundle decision — do not import `libphonenumber-js/max` on the client.** The
  server uses `/max` because it needs `getType()` and the bytes are free there;
  shipping the same metadata to the browser is ~150KB for a form field. Instead:

  - The country list comes from `GET /api/meta/countries` (backed by
    `countryOptions()`), so the dial codes have one source of truth.
  - The client does **presentational formatting only** — digits and spacing.
  - **Real validation is server-side**, returned as a field-level error. This is
    already required regardless, since client validation is never authoritative.

  If live client-side validity feedback proves worth it later,
  `libphonenumber-js/min` is the smaller option — but note it cannot detect
  landlines, so it would be a weaker check than the server's, not an equal one.
- **`angkatan` becomes a constrained year input.** It is an `integer`
  ([02](./02-database.md#angkatan-is-an-integer--decided)), and a bare
  `type="number"` accepts `19` and `20255` alike. Use a `Select` of valid years
  (descending, current year first) rather than free entry — the range is finite
  and short, it removes typos entirely, and on mobile it replaces keyboard entry
  with a picker.
- **`bidang_pekerjaan` / `subbidang_pekerjaan` become `Autocomplete`** over
  existing distinct values (freeSolo). Free text is why the stats page shows
  near-duplicate categories — this fixes the data at the source, which no amount
  of chart work can do downstream.
- **Success state:** currently a toast and a cleared form, which looks like
  nothing happened. Replace with a confirmation panel.
- **Duplicate handling:** submitting a number already in the table currently
  creates a second row. Detect it and offer "perbarui data saya" instead.

## Admin dashboard

Keep it dense — that is correct for the audience — but fix:

- **Add a delete confirmation.** One click, hard delete, no undo
  ([07](./07-security.md#p2--destructive-delete-with-no-confirmation)).
- **Show the pending contact requests**, if the brokered-contact flow is built
  server-side. Today the admin's actual daily job — answering WhatsApp requests —
  happens entirely outside this tool.
- Server-side pagination/sort/filter ([04](./04-api.md#get-apialumni--admin)).
- Move the admin's own contact number here as an editable setting.

## Cross-cutting

- **Page titles:** `Home` and `Statistik` set `document.title`; the others do
  not. Set it in one place per route.
- **The nested gradient:** `Layout` wraps everything in a gradient, then `Home`
  and `Statistik` each render *their own* `min-h-screen` gradient div inside it.
  Two stacked full-height gradients. Removed by the theme work in 05.
- **`Stats.jsx` is dead code** — a Pie chart component that nothing imports.
  Delete it, or fold it into the statistics redesign ([09](./09-statistics.md)).
- **Focus states, keyboard nav, and `aria-label`s** on every icon-only button —
  the shield link and all Dashboard row actions are currently unlabeled icons.

## Success criteria

1. The search field is visible without scrolling on a 375×667 viewport.
2. The nav does not overflow at 320px.
3. Typing a 6-character query issues one request, not six.
4. A server error shows an error state, not "no alumni found."
5. A card with only nama/angkatan/whatsapp renders no "N/A" text.
6. The contact button opens WhatsApp with the alumnus identified in the message.
7. Submitting with only nama, angkatan, and whatsapp succeeds.
8. Every interactive element is reachable and operable by keyboard.
