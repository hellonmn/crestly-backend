# Crestly — Calendar · Contact (masked calling) · Tests

Three modules added on top of the Phase-1 base. Each follows the existing
conventions: a Zod contract in `packages/shared`, a NestJS `controller +
service` in `apps/api`, React pages + TanStack-Query hooks in `apps/web`,
and parent-portal endpoints under `/api/parent/*`.

> **Before anything works:** apply the two SQL migrations (below) to **every
> tenant school DB _and_ the founding/platform DB**. There is no Prisma
> Migrate in this repo — SQL is applied externally, then `prisma db pull`
> reconciles the schema. The Prisma models were hand-authored to match.

---

## 1. Migrations

```bash
# For each school database (and the platform DB), run:
mysql -u <user> -p <db_name> < apps/api/migrations/2026_06_26_calendar_events.sql
mysql -u <user> -p <db_name> < apps/api/migrations/2026_06_26_tests.sql
```

Both files are idempotent (`CREATE TABLE IF NOT EXISTS`, self-recording in
`schema_migrations`). After applying, regenerate the client:

```bash
npm run db:generate -w @crestly/api
```

New tables: `calendar_events`, `tests`, `test_questions`, `test_attempts`,
`test_attempt_answers`.

---

## 2. School Calendar

A new `calendar_events` table for general events (PTM, functions, fee due
dates, notices…). The read feed **merges** these rows with the existing
`holidays` and `exam_datesheet` data into one day-by-day stream.

**Staff** (`apps/web` → sidebar **Records → Calendar**, route `/calendar`):

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET    | `/api/calendar/feed?month=YYYY-MM` (or `from`/`to`, `classSlug`, `includeHolidays`, `includeExams`) | Merged feed |
| GET    | `/api/calendar/events?session=` | Raw editable events |
| POST   | `/api/calendar/events` | Create event |
| PUT    | `/api/calendar/events/:id` | Update event |
| DELETE | `/api/calendar/events/:id` | Delete event |

Events carry a `category`, `audience` (`all` / `staff` / `parents`), optional
class scoping, an optional time window, and an `isHoliday` flag. Only `event`
rows are editable; holiday/exam items are read-only mirrors.

**Parent** (route `/parent/calendar`, linked from **More**):

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/parent/calendar?sr=&month=YYYY-MM` | Same feed, parent-visible audiences only, scoped to the child's class |

---

## 3. Contact — office-hours gating + masked calling (Exotel)

Enhances the existing parent contact page. Parents reach principal,
coordinator, accountant, class teacher and subject teachers — but:

- **Office-hours gating** — each staffer returns `canCallNow` (true only
  inside their duty/office window). Outside it, the call button is disabled
  and only WhatsApp is offered.
- **Masked calling** — when Exotel is configured, **personal numbers are
  never sent to the client** (`phone`/`whatsapp` come back `null`,
  `callMasked: true`). Parents place a call via the API and Exotel bridges
  both legs behind the ExoPhone — neither side sees the other's number
  (the Uber/Blinkit model). The same window gating is enforced server-side.
- **After-hours WhatsApp** routes through the school's WhatsApp business
  number (`schoolWhatsapp` on the response), so personal numbers stay private
  there too.

When Exotel is **not** configured, the page falls back to showing numbers
directly (backward-compatible).

**Settings** (`apps/web` → sidebar **System → Masked Calling**, route
`/settings/calling`):

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET  | `/api/calling/settings` | Current config (secrets masked) |
| PUT  | `/api/calling/settings` | Save SID / host / ExoPhone / API key + token |
| POST | `/api/calling/settings/test` | Verify credentials against Exotel |

Config is tenant-scoped, stored in `app_settings` under `exotel.*` keys
(mirrors the AI-assistant settings pattern).

**Parent masked call:**

| Method | Path | Body | Purpose |
| ------ | ---- | ---- | ------- |
| POST | `/api/parent/contact/call` | `{ sr, staffId }` | Bridge a masked call; returns status only, no numbers |

> **Exotel note:** the integration uses Exotel's *connect two numbers* API.
> Numbers must be dial-ready for your account (usually a `0` / `+91` prefix).
> Confirm your stored staff/parent numbers match what Exotel expects.

---

## 4. Tests — MCQ + fill-in-the-blanks

Teacher-authored, auto-graded, attempted by students through the parent
portal. One attempt per child per test; MCQ supports multiple correct
options, fill-blank supports multiple accepted answers (case-sensitivity
toggle).

**Staff** (`apps/web` → sidebar **Records → Tests**, route `/tests`):

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET    | `/api/tests?session=&class=&status=` | List |
| GET    | `/api/tests/:id` | Full test incl. answer key |
| POST   | `/api/tests` | Create (with questions) |
| PUT    | `/api/tests/:id` | Update (blocked once attempts exist) |
| POST   | `/api/tests/:id/publish` · `/close` | Lifecycle |
| DELETE | `/api/tests/:id` | Delete (cascades attempts) |
| GET    | `/api/tests/:id/results` | Per-student scores + class average |

**Parent** (routes `/parent/tests`, `/parent/tests/:id`, linked from **More**):

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET  | `/api/parent/tests?sr=` | Published tests for the child's class, with state + prior score |
| GET  | `/api/parent/tests/:id?sr=` | Playable test — questions **without** the answer key |
| POST | `/api/parent/tests/:id/submit` | `{ sr, answers[] }` → auto-graded; returns score + per-question correctness with the key revealed |

Grading lives in `apps/api/src/tests/tests.grading.ts` (pure helpers, shared
by staff and parent flows).

---

## 5. Demo seed

Populates a few calendar events + one published demo test (2 MCQ + 1
fill-blank) so the screens have data:

```bash
npm run seed:features -w @crestly/api
# optional: FEATURE_CLASS_SLUG=6 npm run seed:features -w @crestly/api
```

Idempotent — guards on titles, safe to re-run.
