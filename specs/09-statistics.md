# 09 — Statistics Page

Redesign of `/statistik` with real charts. DB changes included.

## What's wrong now

`Statistik.jsx` renders every category value as a card containing a `text-7xl`
number, in a 3-column grid, sorted by count.

- **A wall of 72px numbers is not a comparison.** Thirty cards each shouting a
  figure means the reader compares by scanning digits. That is the job a bar
  chart does in one glance.
- **Long tail included.** Every distinct value gets a card, so a category with
  one alumnus occupies the same visual weight as one with ninety.
- **No charts at all** — despite `chart.js`, `react-chartjs-2`, and
  `chartjs-plugin-datalabels` all being installed dependencies.
- **`Stats.jsx` is dead code**: a Pie chart of `bidang_pekerjaan` that nothing
  imports. Its six hardcoded `rgba(...)` colors are arbitrary, and a pie is the
  wrong form for 6+ categories regardless.
- **The `provinces` bug** — a variable filtered from `domisili_kota` but named
  provinces ([05](./05-frontend.md#bugs-to-fix-during-migration)).
- **Data quality shows through.** `bidang_pekerjaan` is free text, so the page
  displays near-duplicate categories as separate bars. Fixed at the source by
  the `Autocomplete` change in [08](./08-ux-redesign.md#registration--daftar);
  no chart work can compensate for it.

## Form selection

Every question on this page is **"compare magnitude, low → high"** across named
categories. That answer is a **bar chart with a sequential (single-hue) scale** —
not categorical color, because the categories are not the subject; their sizes
are. It is also emphatically not a pie.

Bars run **horizontal**, because the labels are long Indonesian category names
("Penelitian dan Pengembangan", "Jawa Barat"). Horizontal bars give labels room
to be read left-to-right without rotation.

| Section | Question | Form |
|---|---|---|
| Hero | How many alumni are there? | **Hero figure** — keep, no chart |
| KPI row | Cities, provinces, fields, companies | **Stat tiles** |
| Sebaran Wilayah | Where are alumni? | Horizontal bar, top 10 + "Lainnya" |
| Bidang Pekerjaan | What work do they do? | Horizontal bar, top 8 + "Lainnya" |
| Angkatan | How are cohorts distributed over time? | **Column chart** (new) |
| Perusahaan | Which employers recur? | Horizontal bar, top 10 (new) |

**Angkatan is the most valuable addition.** It is the only genuinely
time-ordered dimension in the data, it answers a question alumni actually ask
("who else is from my year?"), and it is the one chart that must be sorted by
year rather than by count — a column chart in chronological order, not a ranked
bar.

### Top-N and "Lainnya"

Charts cap at 8–10 bars with the remainder aggregated into "Lainnya". Past ~8
categories a reader stops comparing and starts reading a table — so the full
data is available as a **table view toggle** on every chart, which is also how
the contrast obligation below is met.

The aggregation must be **visible**, never silent: the "Lainnya" bar is labeled
with how many categories it absorbs.

## Color

**Sequential, one hue, light→dark**, from the theme's blue ramp — the same blue
as `primary.main`, so the charts belong to the page. More-is-darker.

Bars in a ranked chart all use a **single step** (`#2a78d6`) rather than a
gradient across the ramp; the bar *length* already encodes magnitude, and
varying lightness too would double-encode it while implying a second dimension.
The ramp is used where value maps to color — i.e. nowhere on this page unless a
map or heatmap is added later.

**No categorical palette is needed on this page.** For reference, the intended
categorical set was validated against this page's `#FAF9F6` surface:

```
node scripts/validate_palette.js "#2a78d6,#008300,#e87ba4,#eda100,#1baf7a,#eb6834" \
  --mode light --surface "#FAF9F6"

[PASS] Lightness band · [PASS] Chroma floor
[PASS] CVD separation      worst adjacent ΔE 9.1 (protan)
[PASS] Normal-vision floor worst adjacent ΔE 19.6
[WARN] Contrast vs surface below 3:1 for 3 slots — relief required
```

The WARN is **not dismissable**: it obligates visible labels or a table view.
Both are specced below, so the obligation is met. Re-run the validator for dark
mode if dark mode is ever added — it is a separate selection, not a flip.

## Mark and label rules

- Bars: 4px rounded ends at the data end, square at the baseline.
- **2px surface-colored gap** between adjacent bars.
- **Direct value labels on every bar** — this is the contrast relief, and with
  ≤10 bars it does not clutter. (The "never label every point" rule targets
  dense line/scatter charts, not a 10-bar ranked chart.)
- Recessive axes: no vertical gridlines, no chart border, gray tick labels.
- **No legend** — single series, and the section heading names it.
- Y-axis (category names) left-aligned, full text, no truncation. If a name is
  too long for the container, wrap it; do not ellipsize a data label.

## Interaction

Per the interaction rules, an HTML chart ships hover by default:

- **Per-bar hover tooltip**: category, count, and percent of total.
- Hit target spans the full row height, not just the drawn bar — a 12px bar is
  an unusable target, especially on touch.
- **Table view toggle** on each chart. Same data, sortable, complete (no top-N
  cap). This is the accessible path and the way to see the long tail.
- **One filter row above all charts**, not per-chart: filter by angkatan range.
  Filtering must not repaint or reorder colors — single hue, so this holds
  trivially.

`chartjs-plugin-datalabels` is already installed and is what draws the direct
labels. Keep `chart.js`; it does everything above and is already a dependency.

## Database changes

The `alumni_stats` materialized view ([02](./02-database.md)) currently emits
three categories. Add three:

```sql
CREATE MATERIALIZED VIEW alumni_stats AS
  -- existing three
  SELECT 'domisili_provinsi' AS category, domisili_provinsi AS value, COUNT(*)::int FROM alumni_data WHERE COALESCE(domisili_provinsi,'') <> '' GROUP BY 1,2
  UNION ALL SELECT 'domisili_kota',    domisili_kota,    COUNT(*)::int FROM alumni_data WHERE COALESCE(domisili_kota,'')    <> '' GROUP BY 1,2
  UNION ALL SELECT 'bidang_pekerjaan', bidang_pekerjaan, COUNT(*)::int FROM alumni_data WHERE COALESCE(bidang_pekerjaan,'') <> '' GROUP BY 1,2
  -- new
  UNION ALL SELECT 'angkatan',    angkatan::text, COUNT(*)::int FROM alumni_data WHERE angkatan IS NOT NULL GROUP BY 1,2
  UNION ALL SELECT 'perusahaan',  perusahaan,  COUNT(*)::int FROM alumni_data WHERE COALESCE(perusahaan,'')  <> '' GROUP BY 1,2
  UNION ALL SELECT 'jabatan',     jabatan,     COUNT(*)::int FROM alumni_data WHERE COALESCE(jabatan,'')     <> '' GROUP BY 1,2;

CREATE UNIQUE INDEX alumni_stats_pk ON alumni_stats (category, value);
```

`COALESCE` guards are required on the text columns — the original `<> ''`
predicate drops nothing when the column is NULL rather than empty, so NULLs would
appear as a chart category with an empty label.

**`angkatan` is the exception and needs `::text`.** It is an `integer`
([02](./02-database.md#angkatan-is-an-integer--decided)), and every branch of a
`UNION ALL` must agree on column type. Without the cast the view fails to create.
Its guard is `IS NOT NULL`, not `<> ''` — an integer is never the empty string.

**Sorting the angkatan chart:** the view emits `value` as text for union
compatibility, so the frontend must sort it as a **number**
(`Number(a.value) - Number(b.value)`), not with the default string comparison.
Lexicographic ordering of 4-digit years looks correct and hides the bug — until a
3-digit typo or a 5-digit value sorts to the wrong end. Sort numerically and let
the validation range in 02 keep the data clean.

`jabatan` is included for admin interest but is **not charted** — job titles are
free text and too high-cardinality to be meaningful. It is available via the
table view. Noting this so nobody adds the chart later assuming it was an
oversight.

No change to `alumni_data` itself. The API contract (`GET /api/stats`) is
unchanged — it returns more rows, in the same `{category, value, count}` shape,
so the frontend's grouping logic needs no restructuring.

**Normalisation caveat:** `perusahaan` is free text, so "PT Pertamina",
"Pertamina", and "pertamina" are three rows. The company chart will be wrong
until entry is normalised. Ship it with an `Autocomplete` on the form
([08](./08-ux-redesign.md)) and accept that historical data is messy, or add a
`company_normalized` column and a cleanup pass — out of scope here, but the
chart's accuracy is capped by this.

## Layout

```
Hero:      1.234 alumni
KPI row:   [ 87 Kota ] [ 24 Provinsi ] [ 12 Bidang ] [ 340 Perusahaan ]
Filter:    [ Angkatan: 1980 ——●———— 2025 ]
Charts:    Angkatan (full width column chart)
           Sebaran Wilayah  |  Bidang Pekerjaan   (2-col ≥md, stacked <md)
           Perusahaan (full width)
```

Hero keeps the existing gradient-text treatment — it is the one place a 72px
number is right, because it is genuinely the headline figure.

The current "tersebar di N Kota di seluruh dunia" sentence becomes the KPI row,
which says the same thing without a sentence whose variable is misnamed.

Charts stack to one column below `md`; see [11](./11-mobile.md) for the
horizontal-scroll and touch-target rules.

## Success criteria

1. No pie chart anywhere; `Stats.jsx` deleted.
2. Every chart is single-hue; no chart uses more than one hue.
3. Every bar carries a visible value label.
4. Each chart has a working table-view toggle showing untruncated data.
5. The "Lainnya" bar states how many categories it aggregates.
6. Angkatan is ordered chronologically, not by count.
7. Charts render correctly with 0 rows, 1 row, and 500 distinct categories.
8. Refreshing the view after adding one alumnus updates all six categories.
9. No dual-axis chart exists.
10. Rendered output has been opened and visually checked for label collisions.
