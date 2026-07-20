# 11 — Mobile

Mobile is the primary target, not an adaptation. An alumni directory is looked up
on a phone — someone is at an event, or has just been given a name.

Nothing in the current codebase has a mobile treatment: there is not a single
`sm:` or `md:` breakpoint prefix in `Layout.jsx`, and the responsive classes that
do exist elsewhere are incidental.

## Baseline

Design at **360×640** (the common Android floor), verify at **320px** (iPhone SE
/ older Android). Breakpoints follow MUI defaults: `xs` 0, `sm` 600, `md` 900.

## Known mobile breakages in the current code

Each is a concrete defect, not a stylistic note.

| Location | Problem |
|---|---|
| `Layout.jsx` nav | `space-x-10 text-2xl` — three 24px labels + button. Overflows below ~600px with no wrap or menu |
| `Layout.jsx` logo | 64px logo in a nav bar that also has to fit four items |
| `SearchHeader.jsx` | `w-80 h-80` — a **320px** logo. On a 320px viewport it is the entire screen width, and the search field sits below the fold |
| `SearchHeader.jsx` input | `py-5 text-lg pl-16` — acceptable, keep the generous height |
| Headings | `text-5xl` (48px) headlines on a 360px screen; "Database Alumni Kimia Unpad" wraps to three lines |
| `Home.jsx` results | `flex flex-column flex-wrap` — **`flex-column` is not a Tailwind class** (it is `flex-col`). The class is dead; the layout works by accident of `flex-wrap` |
| `ResultCard.jsx` | `min-w-[308px]` inside a container with `px-4` (32px). At 320px viewport: 308 + 32 = 340 > 320 → **horizontal page scroll** |
| `Statistik.jsx` | `text-7xl` (72px) numbers in `md:grid-cols-3`; single column on mobile means one enormous number per screen |
| `Dashboard.jsx` | A 10-column table in `overflow-auto`. Technically scrolls, practically unusable |
| Icon buttons | Lucide icons at `size={18}` with no padding — an 18px touch target throughout the Dashboard |

The `ResultCard` overflow is the one to fix first: horizontal scroll on the main
page is the most visible possible mobile bug.

## Rules

### Touch targets

**Minimum 44×44px** for anything tappable. The Dashboard's 18px edit/delete
icons and the nav's icon-only shield link all fail this today.

In MUI: `IconButton` defaults to 40px — set `size="large"` or add padding to
reach 44. Do not shrink the icon glyph to compensate; grow the hit area around it.

Delete and edit sit **adjacent** in the Dashboard row. At 18px with a 24px gap
they are a mis-tap away from an unconfirmed hard delete
([07](./07-security.md#p2--destructive-delete-with-no-confirmation)). Separate
destructive actions from routine ones, or move delete into an overflow menu.

### Navigation

Below `md`: hamburger → `Drawer` (temporary, left). Logo shrinks to 40px in the
`AppBar`. Full-width menu items at 48px row height.

The admin link leaves the public nav entirely
([08](./08-ux-redesign.md#navigation)) — which also removes the item that made
the bar overflow.

Consider a bottom navigation bar for the four primary destinations. Thumb reach
on a 640px-tall screen makes a top bar awkward for the app's core repeated
action, and this app has exactly the right number of destinations for it (3–5).
Judgement call — but if the drawer is chosen, the search field must still be
reachable without opening it.

### Typography

Scale headings down rather than letting 48px text wrap three times:

```js
sx={{ fontSize: { xs: '1.75rem', sm: '2.25rem', md: '3rem' } }}
```

The statistics hero figure keeps its impact but caps at `2.5rem` on `xs`; the
current `text-7xl` (72px) forces "1.234" to fill the viewport width.

Body text never below **16px** — iOS Safari zooms the viewport on focus of any
input with a font-size under 16px, which is jarring and hard to recover from.
The search input's `text-lg` is fine; verify every `TextField` in the form.

### Layout

- **Single column below `sm`.** Result cards go full-width: replace
  `min-w-[308px] md:w-1/4` with `width: { xs: '100%', md: 'calc(25% - 16px)' }`.
- Container padding 16px on `xs` — and it must be *inside* the width
  calculation, which is what the current card gets wrong.
- **Never allow horizontal page scroll.** `overflow-x: hidden` on the body is a
  patch, not a fix — find the element that exceeds the viewport.
- Home page: logo to ~72px on `xs`, search field above the fold. Non-negotiable;
  it is the page's only job.

### Forms

- Full-width inputs, 48px min height.
- **Correct input modes** — this materially reduces typing effort:
  - `whatsapp`: `type="tel"` `inputMode="tel"` (already `tel`, keep)
  - `angkatan`: a `Select` of years, not a text input
    ([08](./08-ux-redesign.md#registration--daftar)) — a native picker beats a
    number pad on mobile and makes an invalid year unenterable
  - `autoComplete="tel"`, `"organization"`, `"name"` where they apply
- The nine-field form is long on mobile; the three-section grouping from
  [08](./08-ux-redesign.md#registration--daftar) gives it structure. Do not use a
  multi-step wizard — the form is short enough that steps add friction.
- Submit button **sticky at the bottom** on `xs` so it is reachable without
  scrolling to the end.

### Charts

From [09](./09-statistics.md):

- Charts stack to one column below `md`.
- **Horizontal bars work better on narrow screens than vertical** — they grow
  downward, which is the direction a phone has room in. This reinforces the
  choice already made for label length.
- Reduce to **top 5** bars on `xs` (from 8–10), with the table view carrying the
  rest. A 10-bar chart at 360px gives each bar ~20px of height.
- **Never** horizontally scroll a chart. If it does not fit, show fewer
  categories or switch to the table.
- Chart.js `maintainAspectRatio: false` with an explicit container height, or
  charts collapse to unusable proportions on narrow viewports.
- Tooltips fire on `touchstart`; ensure they dismiss on tap-outside, since there
  is no hover-off event on touch.

### Admin dashboard

A 10-column table cannot be made good on a phone. Two honest options:

1. **Card list below `md`** — each alumnus as a card with the 3–4 key fields and
   an expand for the rest. Editing opens a full-screen `Dialog`.
2. **Accept desktop-only** and show a "gunakan perangkat desktop" notice.

**Recommend option 1 for viewing, option 2's dialog for editing.** Admins do
check data on phones; inline-editing ten columns on one is not worth building.

`DataGrid` supports column hiding per breakpoint, which makes option 1 mostly
configuration rather than a second implementation.

### Job board

Cards are already a mobile-friendly form. Filter row collapses into a
bottom-sheet "Filter" button below `sm` — four filter controls in a row do not
fit at 360px.

## Testing

1. Chrome DevTools at 320, 360, 390, 768.
2. **A real device** — touch targets and iOS input zoom do not reproduce in an
   emulator.
3. Every page checked for horizontal scroll: `document.documentElement.scrollWidth
   > window.innerWidth` should be false.
4. Landscape at 640×360 — the search page must still be usable.

## Success criteria

1. No page scrolls horizontally at 320px.
2. The search field is above the fold at 360×640.
3. Every tappable element is ≥44×44px.
4. The nav is usable at 320px.
5. No input triggers iOS zoom on focus.
6. Charts are legible at 360px without scrolling.
7. The admin table is usable — by either route — below `md`.
8. Lighthouse mobile performance ≥ 80 on `/`.
