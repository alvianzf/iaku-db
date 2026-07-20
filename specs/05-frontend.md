# 05 — Frontend

Full migration to MUI. Tailwind removed. White-ish background throughout.

## Theme

`src/theme.js`, applied once in `src/main.jsx`.

The background colour is **`#FAF9F6`** — an off-white, warmer than `#FFF`. This
is not an invention: it is the value already sitting in the commented-out block
at the top of `src/index.css`. It was clearly the intended look before Tailwind
took over, so the migration restores it rather than picking a new shade.

```js
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    background: { default: '#FAF9F6', paper: '#FFFFFF' },
    primary:   { main: '#2563EB' },   // = tailwind blue-600, current accent
    secondary: { main: '#9333EA' },   // = tailwind purple-600, gradient partner
    text: { primary: '#212121', secondary: '#6B7280' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif',
    h1: { fontSize: '3rem', fontWeight: 700 },
  },
});
```

`paper: #FFFFFF` against `default: #FAF9F6` is what separates cards from the
page without needing a border — the current design leans on `bg-white` cards
over a tinted body for exactly this effect.

Primary and secondary are the hex values of the Tailwind classes already in use
(`blue-600`, `purple-600`), so the migration preserves the existing palette
instead of restyling the app. The gradient headline treatment
(`from-blue-600 to-purple-600 bg-clip-text`) is reproduced with `sx` on a
`Typography`:

```js
sx={{
  background: (t) => `linear-gradient(to right, ${t.palette.primary.main}, ${t.palette.secondary.main})`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}}
```

`<CssBaseline />` must be rendered inside `<ThemeProvider>` — it is what applies
`background.default` to `<body>`. Without it the theme's background is set but
never painted.

### Removing Tailwind

Once every component is converted:

1. Delete `tailwind.config.js`, `postcss.config.js`.
2. Uninstall `tailwindcss`, `autoprefixer`, `postcss`.
3. Strip the `@tailwind` directives from `src/index.css`, and delete the dead
   commented-out block above them.
4. `grep -r "className=" src/` should return only the handful of cases below.

Do this **last**. Removing Tailwind while components still depend on it breaks
every page at once and makes the migration impossible to review incrementally.

## Squiggly background

`@alvianzf/squiggly-lines-go-brrr` — used subtly, as the page backdrop behind
the existing layout.

```
npm i @alvianzf/squiggly-lines-go-brrr framer-motion
```

API (v1.0.0):

```ts
<SquigglyBackground
  count?: number
  colors?: string[]           // CSS class names; stroke uses currentColor
  minStrokeWidth?: number
  maxStrokeWidth?: number
  minDuration?: number
  maxDuration?: number
  variant?: 'worms' | 'beetles' | 'ants' | 'thunder'
  className?: string
  backgroundColor?: string
/>
```

### Three integration constraints

**1. Its default colors are Tailwind classes.** The package ships defaults like
`text-red-500/20`, which resolve to nothing once Tailwind is removed — lines
would render in the inherited text colour, i.e. near-black on off-white. Loud,
not subtle. So `colors` must be passed explicitly, as plain CSS classes defined
in `index.css`:

```css
.squiggle-blue   { color: rgba(37, 99, 235, 0.10); }
.squiggle-purple { color: rgba(147, 51, 234, 0.10); }
```

10% alpha is the "subtle" requirement made concrete. The component sets
`stroke="currentColor"`, so a class that sets `color` is all it needs.

**2. `framer-motion` is a required peer dependency** and is a substantially
larger addition than the component itself (~49KB unpacked for the package;
framer-motion is several times that). Flagging it because it is the real cost of
this feature and it is easy to miss — the component looks free and is not. It is
the only animation dependency in the project, so if anything else ever needs
motion, it is already paid for.

**3. Motion must respect `prefers-reduced-motion`.** The component does not
appear to check it. Continuously animating background lines are exactly the
class of motion that triggers vestibular discomfort, so the wrapper handles it:

```jsx
const reduce = useMediaQuery('(prefers-reduced-motion: reduce)');
// render <SquigglyBackground/> only when !reduce
```

### Placement

In `Layout.jsx`, behind everything, non-interactive:

```jsx
<Box sx={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }}>
  <SquigglyBackground
    count={6}
    variant="worms"
    colors={['squiggle-blue', 'squiggle-purple']}
    backgroundColor="#FAF9F6"
    minStrokeWidth={1}
    maxStrokeWidth={2}
    minDuration={20}
    maxDuration={35}
  />
</Box>
```

`count={6}`, thin strokes, and long durations are all deliberate: the package's
own README is candid that performance was not the goal, and a low element count
with slow animation is what keeps it from costing measurable CPU on the search
page. `pointerEvents: 'none'` prevents it from swallowing clicks;
`zIndex: -1` keeps it under the content.

Applied in `Layout` only — so `/dashboard`, which renders a dense data table,
inherits it too. If it proves distracting behind the table, exclude it there;
that is a judgement call to make once it is visible.

## Component migration map

| Current | Becomes |
|---|---|
| `Layout.jsx` nav | `AppBar` + `Toolbar` + `Button component={Link}` |
| `Layout.jsx` footer | `Box` + `Container` + `Typography` |
| `SearchHeader.jsx` input | `TextField` with `InputAdornment` + `CircularProgress` |
| `ResultCard.jsx` | `Card` / `CardContent` + `Stack` |
| Home pagination | `Pagination` — replaces four hand-rolled buttons |
| `Form.jsx` | `TextField` per field + `Button`; `Grid` layout |
| `Login.jsx` | `Card` + `TextField` — **phone, not email** (see 03) |
| `Dashboard.jsx` table | `DataGrid` (`@mui/x-data-grid`) |
| `Dashboard.jsx` modal | `Dialog` + `DialogActions` |
| `react-hot-toast` | `Snackbar` + `Alert` — drop the dependency |
| `lucide-react` icons | **Keep.** Renders fine inside MUI; no reason to churn |

### `DataGrid` is a judgement call

`Dashboard.jsx` hand-rolls sorting, filtering, pagination, and inline editing
across ~230 lines. `DataGrid` does all four natively and would delete most of
that. But `@mui/x-data-grid` is another dependency, and its editing model is
different enough that this is a rewrite of the page, not a port.

**Recommendation: use it.** The hand-rolled version already has bugs the grid
would not have — `filtered.sort()` on line ~100 mutates state in place, and
`a.nama_lengkap.toLowerCase()` throws on any row with a null name.

If the extra dependency is unwanted, `Table`/`TableBody`/`TableSortLabel`
reproduce the current structure directly and keep the diff mechanical. Decide
before starting the page; do not start with one and switch.

## Data layer rewrite

`src/lib/supabase.js` is deleted. `searchAlumni.js` and `getAlumniStats.js` keep
their exported function names and return shapes so calling components need no
changes — only their bodies swap `supabase.from(...)` for `fetch('/api/...')`.

New `src/lib/api.js` wraps `fetch`: prefixes `/api`, sets
`credentials: 'include'` (required — the session cookie is httpOnly), throws on
non-2xx, parses JSON.

`credentials: 'include'` is easy to forget and fails in a confusing way: every
authenticated request returns 401 while the cookie is plainly visible in
devtools.

### Auth context

Supabase's `getSession()` is gone and the cookie is unreadable from JS, so
session state comes from `GET /api/auth/me`.

`src/context/AuthContext.jsx` calls it once on mount and exposes
`{ user, loading, login, logout }`. `Dashboard` and `Login` consume it instead
of calling Supabase.

Both currently use `window.location.href = "/dashboard"` for redirects, which
triggers a **full page reload** and throws away the React tree — in a SPA that
is a bug, not a style preference. Replace with `navigate()` from
`react-router-dom`, which is already imported in `Dashboard`.

## Bugs to fix during migration

Found while reading; each is small and in scope because the file is being
rewritten anyway.

- **`Home.jsx:38`** — `setLoading(true)` runs *after* the `await`, then
  `finally` immediately sets it false. The spinner never appears. Move it before
  the `try`.
- **`Dashboard.jsx:~100`** — `filtered.sort()` mutates the array derived from
  state. Use `[...filtered].sort()`.
- **`Dashboard.jsx:~104` — sorting by Angkatan throws.** The comparator is
  `valA.localeCompare(valB)`, but `angkatan` is an `integer`
  ([02](./02-database.md#angkatan-is-an-integer--decided)), so `valA` is a
  `Number` and `localeCompare` is not a method on it. Clicking the Angkatan
  column header raises a `TypeError` and breaks the table. The `|| ""` fallback
  only rescues null/zero, so the crash appears exactly when the data is good.
  Fix with a type-aware comparator — numeric subtraction for numbers,
  `localeCompare` for strings — or let `DataGrid` handle it, which types columns
  explicitly and is another argument for the recommendation below.
- **`Dashboard.jsx:~97`** — `a.nama_lengkap.toLowerCase()` throws if any row has
  a null name. Guard it.
- **`Statistik.jsx:~25`** — a variable named `provinces` is filtered from
  `category === "domisili_kota"` (cities), then rendered as "Kota di seluruh
  dunia". The label and the data agree; only the variable name is wrong. Rename
  to `cities` — it currently reads as a bug and invites someone to "fix" it in
  the wrong direction.
- **`Statistik.jsx:1`** — `import { use, ... }` imports an unused hook.
- **`ResultCard.jsx:~90`** — the WhatsApp contact button hardcodes
  `wa.me/6287894510004` regardless of which alumnus is shown, while being
  `disabled={!whatsapp}` — implying it was meant to contact that person. Confirm
  the intent: a single admin contact number is a reasonable privacy design, but
  if so the `disabled` binding is misleading and should go.

## Success criteria

1. Every page renders with `#FAF9F6` behind it; no white-vs-off-white seams.
2. `grep -r "@tailwind\|className=\"[a-z-]* [a-z-]*\"" src/` is empty.
3. `package.json` no longer lists `tailwindcss`, `postcss`, `autoprefixer`,
   `react-hot-toast`, `@supabase/supabase-js`.
4. Squiggly lines are visible but do not draw the eye from the search field, and
   disappear entirely under `prefers-reduced-motion: reduce`.
5. The search spinner is visible during a slow query.
6. Login accepts a phone number and rejects an email address.
7. Lighthouse accessibility ≥ 90 on `/` and `/form-alumni`.
