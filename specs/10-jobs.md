# 10 — Job Information (Lowongan)

New feature: a job board at `/lowongan`, managed from the admin dashboard.

Built alongside the auth work in [03](./03-auth.md), because posting and
moderation both depend on roles existing.

## Why this fits the product

The alumni database's real function is connection — and it currently brokers
only one kind (find a person, message the admin). Job posting is the second, and
it is the one with a natural supply: alumni at companies know about openings, and
alumni looking for work are the same audience already searching the directory.

It also makes the existing data more useful. An alumnus who posts a job is
already in `alumni_data` with `perusahaan` and `jabatan` — the posting can be
attributed to them, which is exactly the credibility signal a generic job board
lacks.

## Access model

| Action | Who |
|---|---|
| Browse & search published jobs | **Public**, no login |
| Post a job | `ALUMNI` or `ADMIN` (login required) |
| Publish / reject a submission | `ADMIN` |
| Edit / delete any job | `ADMIN`; author may edit their own while `PENDING` |

**Posting requires a login, browsing does not.** This is the opposite of the
alumni form (public write, [04](./04-api.md#post-apialumni--public-submission))
and deliberately so: a job board with anonymous posting is a spam magnet and a
scam vector, and unlike a directory entry, a fraudulent job posting can cost a
reader money. Requiring an account makes every post attributable.

**All submissions are moderated.** An alumnus-created job lands `PENDING` and is
invisible until an admin publishes it. This is the one place moderation is
non-negotiable — recruitment scams targeting alumni networks are common, and the
association's name is on the page.

## Schema

```prisma
model Job {
  id            String    @id @default(uuid())
  title         String
  company       String
  location      String?
  employmentType EmploymentType @default(FULL_TIME) @map("employment_type")
  workArrangement WorkArrangement @default(ONSITE) @map("work_arrangement")
  description   String    @db.Text
  requirements  String?   @db.Text
  salaryMin     Int?      @map("salary_min")
  salaryMax     Int?      @map("salary_max")
  applyUrl      String?   @map("apply_url")
  applyEmail    String?   @map("apply_email")
  applyWhatsapp String?   @map("apply_whatsapp")
  status        JobStatus @default(PENDING)
  closesAt      DateTime? @map("closes_at")
  postedById    String    @map("posted_by_id")
  postedBy      User      @relation(fields: [postedById], references: [id])
  createdAt     DateTime  @default(now()) @map("created_at")
  publishedAt   DateTime? @map("published_at")

  @@index([status, publishedAt(sort: Desc)])
  @@index([status, closesAt])
  @@map("jobs")
}

enum EmploymentType  { FULL_TIME PART_TIME CONTRACT INTERNSHIP FREELANCE }
enum WorkArrangement { ONSITE HYBRID REMOTE }
enum JobStatus       { PENDING PUBLISHED REJECTED CLOSED }
```

Notes on the choices:

- **`postedById` is required and non-nullable.** Every job traces to an account.
  Deleting a user must not orphan or silently delete their posts — the relation
  has no cascade, so deletion is blocked until posts are reassigned. That is the
  desired behaviour for an audit trail.
- **Three apply channels, all optional, at least one required** (enforced in
  zod, not the DB — it is a cross-field rule). Indonesian job posts realistically
  arrive as an email, a link, or a WhatsApp number; forcing one shape means posts
  get mangled into the wrong field.
- **`applyWhatsapp` runs through `normalizePhone`** ([03](./03-auth.md)) — same
  canonical form as everywhere else.
- **Salary optional, min/max not a single string.** A range as free text cannot
  be filtered or sorted. Optional because Indonesian postings frequently omit it.
- **`closesAt` drives auto-expiry.** A nightly job flips `PUBLISHED` → `CLOSED`
  where `closesAt < now()`. A board full of dead listings is the standard failure
  mode of this feature, and it is entirely preventable.
- **`REJECTED` is kept, not deleted**, so an admin can see what was already
  turned down rather than re-reviewing a resubmission.

The composite index on `(status, publishedAt DESC)` matches the main list query
exactly — it is the only query that runs on every page load.

## API

### `GET /api/jobs` — public

Query: `q`, `employmentType`, `workArrangement`, `location`, `page`, `limit`
(default 12, **max 50**).

Returns `status: PUBLISHED` only. **This filter belongs in the Prisma `where`,
not in a client-side check** — the same class of mistake as the search masking
in [07](./07-security.md#p0--unmasked-data-over-the-wire). A `PENDING` job must
never leave the server.

Shape matches the alumni search contract:
`{ data, page, totalResults, totalPages }`.

### `GET /api/jobs/:id` — public

`PUBLISHED` and `CLOSED` only; `CLOSED` renders read-only with a "lowongan sudah
ditutup" notice rather than 404, so shared links keep working.

### `POST /api/jobs` — authenticated

Creates with `status: PENDING` and `postedById` from **the token**, never the
body. Rate limit **5/day per user** — the account requirement makes per-IP
limiting the wrong key here.

### `PATCH /api/jobs/:id`

`ADMIN`, or the author while the job is `PENDING`. Status transitions are
`ADMIN`-only — an author must not publish their own post, which is the entire
point of moderation.

### `DELETE /api/jobs/:id` — `ADMIN` only

### `GET /api/jobs/pending` — `ADMIN` only

The moderation queue.

## UI

### `/lowongan` — list

- Filter row **above** the list: search, employment type, arrangement, location.
  One row, consistent with the statistics page filter.
- `Card` per job: title, company, location, type chips, relative posted date,
  salary range if present. Truncated description.
- **Empty state that distinguishes causes**: no jobs at all vs. no jobs matching
  the filter. The alumni search fails at exactly this today
  ([08](./08-ux-redesign.md)); don't repeat it.
- **Distinct error state.** Same reasoning.
- `Skeleton` cards while loading.

### `/lowongan/:id` — detail

Full description, requirements, and a single prominent apply action that adapts
to whichever channel was provided. Attribution line: "Diposting oleh Al\*\*\*\*
S\*\*\*\* (Angkatan 2015)" — **masked, consistent with the directory's privacy
model**. Do not leak the poster's real name here after masking it everywhere
else.

### `/lowongan/baru` — post a job

Login-gated. Unauthenticated visitors get an explanation and a login link, not a
redirect that loses their place.

On submit: a confirmation panel explaining it awaits review. Not a toast — the
moderation delay needs explaining, or users will resubmit thinking it failed.

### Admin dashboard

A "Lowongan" tab beside the alumni table: pending queue with publish/reject, and
a list of all jobs filterable by status. A **badge showing the pending count** —
without it, moderation is a queue nobody remembers to check, and the feature
quietly dies.

## Deliberately out of scope

- Applicant tracking — the apply link goes to the employer; this is a board, not
  an ATS
- Job alerts / email digests — no email infrastructure exists
- CV uploads — no file storage, and it would raise data-retention obligations
- Paid or promoted listings

## Success criteria

1. A `PENDING` job never appears in `GET /api/jobs`, verified against raw JSON.
2. An `ALUMNI` cannot set their own job to `PUBLISHED` (403).
3. `POST /api/jobs` with `postedById` spoofed in the body attributes to the token.
4. A job with no apply channel is rejected with a field-level error.
5. `closesAt` in the past means the job is `CLOSED` after the nightly run.
6. The poster's name is masked on the public detail page.
7. Filtering to zero results shows a filter-specific empty state, not an error.
8. The pending badge count matches `GET /api/jobs/pending`.
9. Deleting a user with published jobs is blocked with a clear message.
