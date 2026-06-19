# Crestly · Complete Port Audit

> Source-of-truth audit for the React + Node port of the PHP Crestly ERP. Generated from a deep scan of every PHP file, every migration, the Crestly Design System spec, and the three sibling apps (ERP, super-admin, parent portal). **Nothing below is invention — everything is grounded in the existing source.**

---

## 1. Scope overview

The legacy product is a multi-tenant SaaS made of three sibling PHP apps that share one MySQL platform DB and one DB per partner school.

| App           | Path           | Purpose                                                        | Users                          | Auth                                       |
| ------------- | -------------- | -------------------------------------------------------------- | ------------------------------ | ------------------------------------------ |
| ERP           | `/erp/`        | Day-to-day school operations: attendance, fees, exams, HR, etc.| Staff (admin, principal, teacher, accountant, receptionist, HR, warden) | Phone + password against per-school `users` |
| Super-admin   | `/superadmin/` | Platform control plane: onboard schools, billing, features, branding | Crestly HQ ops              | Email + password against `platform_admins` (separate session cookie) |
| Parent portal | `/parent/`     | View-only PWA for parents: attendance, fees, marks, diary, timetable | Parents / guardians       | Phone + child's DOB (weak shared secret; per-family blast radius) |

**Counts (verified from source):**
- ~41k LOC PHP across 144 files
- **56 database tables** (51 tenant + 5 platform)
- **38 migrations** (sql + php) plus 1 tenant migration
- **30 lib/*.php** business-logic modules under `/erp/lib/`
- **~70** distinct user-facing screens
- **12** distinct permission keys (plus role-scoped fallbacks)
- **6** WhatsApp action keys
- **2** payment integrations (Razorpay for platform-side feature store; HDFC SmartGateway for per-tenant parent fee payments — *only HDFC creds page exists; parent-side checkout endpoint is unfinished*)

---

## 2. Target architecture (already scaffolded under `crestly-app/`)

```
crestly-app/
├── apps/
│   ├── api/         NestJS 10 + Prisma 5 + JWT (Passport) + MySQL
│   ├── web/         Vite + React 18 + Tailwind + shadcn-style UI + TanStack Query  (the ERP)
│   ├── superadmin/  (Batch G) — Vite + React, talks to same API with `platform_admins` JWT
│   └── parent/      (Batch H) — Vite + React PWA, parent phone+DOB JWT
├── packages/
│   ├── shared/      Zod schemas + DTO types (consumed by api / web / superadmin / parent / mobile)
│   ├── design/      Design tokens (Tailwind config), component library (shadcn-extended)
│   └── icons/       Custom 24×24 SVG set @ stroke-width 1.75 (verbatim from PHP)
└── mobile/          (later) React Native (Expo) — parent app first, then teacher punch app
```

Why this shape:
- **Three web apps share one API.** Identical to PHP layout. Avoids duplicating auth, perms, DB access.
- **`packages/shared` is the contract.** Zod schemas double as request validation (NestJS) and form/API validation (React). Same TS types used by the future mobile apps.
- **`packages/design`** is independently installable so super-admin and parent portal pick up brand updates automatically.
- **Multi-tenant routing** is solved exactly like PHP: a request-scoped Prisma client whose connection string is resolved from `partner_schools` at JWT-validation time (already implemented in Phase 1 — see `apps/api/src/tenant/`).

---

## 3. Database — full schema (56 tables)

> Detailed column list, ENUM values, FK relationships, and per-migration provenance are below. **Source of truth: the existing migration files. Port plan: hand-write `prisma/schema.prisma` based on this list, then `prisma db pull` against a live tenant DB to backfill any drift.**

### 3.1 Platform DB (5 tables)

| Table | Purpose | Notes |
| --- | --- | --- |
| `partner_schools` | Registry of every onboarded school + encrypted DB creds + profile (address, board, geofence, brand color, logo) | `db_pass_enc` is AES-256-CBC, key = `sha256(PLATFORM_KEY)`. Already ported in `apps/api/src/tenant/crypto.ts`. |
| `platform_admins` | Super-admin user accounts (email + bcrypt password). | Separate auth lane from `users`. |
| `platform_features` | Module catalogue (label, category, monthly_price, is_core, benefit). | Read at sidebar render time to gate every nav item. |
| `school_features` | Per-school enabled flags. Composite PK `(school_id, feature_key)`. | If no rows for a school → "grandfathered, everything on". |
| `feature_purchases` | Razorpay purchase log + invoice metadata (invoice_no, gst_rate, gst_amount, total_amount, billing snapshot). | Drives invoice numbering `CR/YYYY-YY/NNNN`. |
| `brand_prompt_sets`, `brand_images` | AI brand-image generator state (Brand Studio in super-admin). | JSON-encoded slides; PNG outputs stored in `/erp/uploads/brand/`. |

### 3.2 Tenant DB (51 tables, grouped by domain)

**Academic year & school identity**
- `sessions` (PK `code`; exactly one `is_current=1`; `promoted_from` self-FK)
- `school_info` (KV: school name, address, board, time zone, geofence)

**Students & families**
- `students` (PK `sr_number` — admission roll, never auto-generated; ~50 columns including 027 extras for academic/fee contacts, pickup snapshot, hostel guardian fields)
- `sibling_families` (PK `family_id`; auto sibling-discount engine)
- `pickup_points` (id, name, lat/lng, distance_km, maps link)
- `class_section_summary` (cached per-class counts; importer rebuilds)
- `student_edit_requests`, `student_edit_request_fields` (teacher-requested edits → admin approval)

**Fees & payments**
- `fee_structure` (per-class yearly recurring rates)
- `one_time_fees` (per-class joining fees)
- `transport_slabs` (distance bands; yearly/quarterly/monthly)
- `discounts` (rules — informational)
- `student_fees` (PK composite `(sr_number, session_code)`; the per-student per-year allotment with computed totals + hostel-v2 columns)
- `fee_payments` (receipts; `is_voided` soft-void; unique `receipt_no`)
- `fee_payment_attempts` (HDFC SmartGateway attempts; status `created|pending|success|failed|cancelled|expired`)

**Attendance**
- `attendance` (UNIQUE per `(sr_number, attendance_date)`; status `present|absent|late|excused`)

**Auth (per tenant)**
- `users` (~25 columns: identity, employment, login phone, role_id, reporting_user_id, geofence_pickup_id)
- `roles` (slug-based; 5 system roles: admin, principal, teacher, accountant, receptionist)
- `permissions` (perm_key, label, module, sort_order)
- `role_permissions` (pivot)

**Classes & sections**
- `classes` (slug + name + sort + is_system)
- `sections` (class_id FK, teacher_user_id FK)

**Staff attendance & shifts**
- `staff_attendance` (selfie + geo + distance + outside-geofence flag)
- `staff_schedules` (duty start/end + effective_from)

**Vouchers & ledger**
- `vouchers` (unique `voucher_no`, status state machine, payment_status, optional `salary_user_id` + `salary_month` attribution)
- `voucher_attachments`, `voucher_approvers` (multi-approver flow)

**Notifications & WhatsApp**
- `notifications` (in-app inbox; recipient + type + link)
- `wa_templates` (synced from Meta; components JSON)
- `wa_action_bindings` (per action_key: template + var map)
- `wa_message_log` (every attempt; status `queued|sent|failed`)

**Leaves & holidays**
- `leave_types` (slug + quota + paid + carry_forward + color)
- `leaves` (with half-day enum, attachment, decision trail)
- `leave_balance_overrides` (per-user-per-year adjustments)
- `holidays` (date + type `public|school|optional|weekend`)

**Exams**
- `exam_terms` (PT1, HY, PT2, Annual; weights sum to 100)
- `exam_subjects` (catalog)
- `exam_class_subjects` (which subjects apply to which class)
- `exam_datesheet` (date + max/pass + syllabus per term-class-subject)
- `exam_marks` (per-student marks; absent flag)
- `exam_co_areas` (co-scholastic areas)
- `exam_co_grades` (A/B/C per student per area per term)
- `stream_subjects` (11-12 PCM/PCB/Commerce mapping)

**Timetable & diary**
- `timetable_periods` (per session: period_no + name + time + is_break)
- `timetable_entries` (UNIQUE per cell; primary + parallel-elective columns)
- `class_diary` (daily teaching log + homework per period)

**Dashboard reviews**
- `dashboard_reviews` (per-user-per-day-per-key audit log of "I checked this tile today")

**Promotion**
- `student_promotions` (UNIQUE `(sr_number, to_session)`; action `promoted|graduated|held_back`)

**Admissions CRM**
- `admission_enquiries` (full lead pipeline)
- `admission_followups` (per-enquiry timeline)

**Hostel**
- `hostel_rooms` (Boys/Girls, Triple/Twin/Single, capacity, floor)
- `hostel_allocations` (one current allocation per student enforced by UQ)

**App settings**
- `app_settings` (KV for WhatsApp creds, payment-gateway creds, billing/Razorpay keys, pricing config, etc.)

### 3.3 ENUM catalogue (exact values — must match in Prisma)

| Domain | Values |
| --- | --- |
| Student gender | Male, Female, Other |
| Student status | active, inactive |
| Fee admission_status | Continuing, New |
| Fee payment_status | paid, partial, pending, overdue |
| Room type | Triple, Twin, Single |
| Payment method | cash, upi, bank_transfer, cheque, card, other |
| Attendance status | present, absent, late, excused |
| Punch type | in, out |
| Geofence type | school, pickup |
| Voucher status | draft, pending_approval, approved, rejected, cancelled |
| Voucher payment_status | unpaid, paid, partial |
| Voucher approver status | pending, approved, rejected |
| WA message status | queued, sent, failed |
| Leave half_day | none, first_half, second_half |
| Leave status | pending, approved, rejected, cancelled |
| Holiday type | public, school, optional, weekend |
| Co-scholastic grade | A, B, C |
| Promotion action | promoted, graduated, held_back |
| Enquiry source | walk_in, phone, website, referral, social, newspaper, hoarding, event, other |
| Enquiry status | new, contacted, visit_scheduled, visited, application, admitted, lost |
| Hostel block | Boys, Girls |
| Partner school status | onboarding, active, suspended |
| Account status | active, inactive |
| Feature purchase status | created, paid, failed |
| Fee payment attempt status | created, pending, success, failed, cancelled, expired |

### 3.4 Notable schema rules

- `students.sr_number` is **manually assigned** (admission roll number) — never autoincrement.
- `student_fees`, `attendance`, `exam_marks`, `dashboard_reviews`, `student_promotions`, `class_diary`, `timetable_entries`, `voucher_approvers`, `hostel_allocations`, `school_features` all use composite uniques — Prisma must model these as `@@unique(...)`.
- `feature_purchases.invoice_no` is `CR/YYYY-YY/NNNN`, sequential per FY.
- Migration **029** drops `books_uniform_est` from both `fee_structure` and `student_fees`. Do **not** model that column.
- Migration **025** is a *data wipe* (TRUNCATE), not schema-altering — irrelevant to Prisma.
- `student_edit_requests`/`student_edit_request_fields` are referenced in `lib/edit_requests.php` and migration 025 but have **no CREATE TABLE** in the repo. Schema is inferred — confirm against a live DB before porting.

---

## 4. ERP page-by-page inventory

The ERP exposes ~70 user-facing screens. Each row is "one URL → one React route + one or more API endpoints".

### 4.1 Master navigation

Sidebar is role-aware (`lib/nav.php` :: `nav_sidebar_items($role)`) and additionally feature-flag-gated (`school_feature_on('online-fees')` etc.). Mobile bottom-nav has 3 role-picked tabs + a "More" tile that drops to `menu/index.php`. Nav groups are collapsible and remember state per user in `localStorage`.

```
DASHBOARD                  every role
RECORDS
  review-history           admin/principal
  students                 students.view (FAB: students.manage)
  classes                  classes.view (manage: classes.manage)
  attendance               attendance.mark (teachers scoped to assigned sections)
  timetable                timetable.view (manage: timetable.manage)
  diary                    diary.log
  exams                    exams.view / enter_marks / manage
  streams                  students.view
  families                 admin/principal/accountant/receptionist
  hostel                   admin/principal/hr/warden/accountant
  admissions               admissions.view (manage: admissions.manage)
FINANCE
  fee-ledger               admin/principal/accountant
  fee-structure            (manage rates)
  ledger                   ledger.view
  vouchers                 vouchers.view_all/.create/.approve/.pay
  daily-report             ledger.view
LOGISTICS
  transport
HR
  team                     team.view (manage: team.manage / roles: team.roles)
  approvals                login (admin sees queue; others see own)
  promotion                students.promote
  import                   admin
  notifications            login
  punch                    staff.punch
  staff-attendance         staff.view_all / staff.view_team
  shifts                   shifts.manage
  salary                   self or admin/hr (others)
  hr                       hr.dashboard
  leaves                   leaves.apply / approvers
  holidays                 login
SYSTEM
  settings                 admin/principal (sub-pages: whatsapp, wa-templates, wa-samples, wa-log, payment-gateway)
  features (Upgrade Plan)  admin only — Razorpay flow
  pricing                  redirect → /erp/
  login.php / logout.php
  menu/index.php           Mobile "More" tile grid
```

### 4.2 Module screens — detail (every screen + actions + perms)

> Truncated below for brevity; the full table is reproduced module-by-module in `AUDIT-PAGES.md` (one row per .php file with: title, purpose, UI elements, actions, permission). Highlights:

- **Dashboard** (`index.php`) — role-scoped homepage. Admin sees ~12 cards (banners, daily-review checklist, KPI tiles, fee collection sparkline, cashflow, expense donut, payroll snapshot, hostel/transport/exam tiles, class distribution, recent students). Teachers see only their sections + today's attendance. Also serves `_ajax=review_check/uncheck/reset_day`.
- **Students** — list, view, edit, request-edit (teacher-side limited form). View has tabs (Bio/Fees/Family), edit has 8 numbered form sections (Identity, Academic, Parents, Contact, Accommodation, Sibling family, Pickup point, Hostel).
- **Attendance** — daily roster with 4-pill toggle (P/A/L/E) per student, auto-save AJAX. History page shows per-student monthly calendar.
- **Fee-ledger** — list with progress bars, payment recorder with quick-amount chips, voidable receipts, A4 print receipt with two-up parent+school copy + amount-in-words.
- **Exams** — terms, subjects (with class assignment matrix), datesheet, marks entry, co-scholastic A/B/C, class results (rank list + grade distribution), marksheet (printable per-student, single-term or full-session).
- **Vouchers** — create with attachments + multiple approvers + optional salary attribution; per-voucher approve/reject/mark-paid flow; comments timeline.
- **Promotion** — section-by-section promotion with hold-back support; bulk "PROMOTE" / "SWITCH SESSION" confirmation flow.
- **Punch** — self-service: geolocation → selfie via front-cam modal → punch button, geofence check.
- **Admissions** — CRM with new-enquiry form, status pipeline (new → contacted → visited → application → admitted/lost), per-enquiry timeline of follow-ups, convert to student.
- **Hostel** — block landing → rooms grid → boarders roster → fees schedule → schedule & rules.
- **Settings** — School identity + geofence + punch policy + 4 WhatsApp sub-pages (Settings, Templates, Sample templates, Log) + Payment Gateway (HDFC SmartGateway, gated by `online-fees` feature).

### 4.3 Recurring UI patterns (must be implemented once, used everywhere)

- **Page-head:** `.label` crumb (orange) → `<h1>Title<span class="brand-dot">.</span></h1>` → `.lede` description.
- **Stat tile row:** 4-up grid of `.stat-tile` (40×40 tinted icon + label + value + delta). Tints are semantic: mustard=primary counts, wheat=neutral/session/class, rose=financial totals, mint=active/success, peach=archive, sky=info.
- **List landing:** toolbar with search + select filters + Reset + primary CTA. Body has parallel desktop CSS-grid table + mobile `.m-list` of `.m-list__item` rows (avatar + body + meta + chevron). Live AJAX search.
- **Detail page:** mobile `.m-back-link` + `.m-hero` + `.m-quick-actions` + `.m-tabs`; desktop `.page-head` + `.toolbar` + two-column `.grid.grid--split`.
- **Edit form:** `<form class="card">` with numbered `.form-section` blocks → `.form-grid` of `.field` blocks. Sticky save bar on mobile.
- **Pills:** `.pill .pill--{success|warn|error|info|neutral|wheat|mint|sky|rose|mustard|peach}` with optional `.pill__dot`.
- **Class pills:** `.cls-pill` wheat-tinted, mono 11px.
- **Confirmation prompts:** destructive actions use `confirm()`; high-impact actions require typing a keyword (`PROMOTE`, `SWITCH`, `DELETE`).
- **AJAX endpoints:** every interactive page serves its own `?_ajax=name` POST that returns `{ok, msg}` JSON + drives a toast.
- **WhatsApp send:** `.js-wa-send` buttons with `data-action`/`data-sr`, calling `/erp/api/wa-send.php`.

---

## 5. Super-admin + Parent portal

### 5.1 Super-admin (~16 pages)

- **Dashboard** — 4 stat tiles + recent schools + quick actions.
- **Schools** — table of every partner school; click → `school.php`.
- **School detail (`school.php`)** — edit identity/creds/profile/branding; **Test connection**, **Provision database** (clones live ERP schema + seeds roles/perms/sessions + creates first admin with `Welcome@NNNN` temp password), **Reset admin password**, **Sync profile to school**, **Change status**.
- **School features** — per-school checkbox grid + live "EST. MONTHLY" total banner.
- **Onboard** — single form to register a new tenant (pulls prefill from `?name=` if coming from enquiries).
- **Features & pricing** — master catalog with per-feature `monthly_price` inputs.
- **Pricing strategy** — tier cards stored as JSON in `app_settings`; brochure with client-side PDF/JPG export via jsPDF+html2canvas.
- **Enquiries** — CRM for crestly.in "Book a demo" leads (`marketing_leads` table; lazy-created).
- **Billing** — Razorpay key_id/key_secret + recent purchases list.
- **Invoice** — printable tax invoice for one purchase; CGST+SGST split for intra-state (Rajasthan/08) else IGST; PAID watermark.
- **Ledger** — overview (per-school revenue) OR per-school transaction history. CSV export.
- **Upgrades** — apply pending tenant DB migrations to every active school (idempotent via `schema_migrations` table).
- **Brand Studio** — feature × format × tone × audience × theme → generates mixed-script (Devanagari+Latin) marketing prompts; per-slide image generator with two providers (local SVG composite engine — free; Ideogram API — paid). Stores in `brand_prompt_sets` + `brand_images`.
- **Brand settings** — per-feature screenshot uploads + Ideogram API key (encrypted at rest).
- **Brand guidelines** — full HTML brand-book viewer + Markdown/ZIP download (palette.css + logos + README).
- **Admins** — manage other super-admins.
- **Account** — self-service profile + change-password.

### 5.2 Parent portal (~10 pages)

- **Login** — phone + DOB DDMMYYYY → matches against 7 phone fields on `students` + `dob`; finds family by `family_id`.
- **Home** — one card per child (multi-sibling stack): hero with class/SR/age/blood/HOSTEL pill, today-attendance pill + month % ring + P/L/A/E counts, big tiles for Diary/Timetable, academics card (overall %, grade, PASS/FAIL, top + weak subject), family details, transport cell, 4-button action bar.
- **Attendance** — kid switcher + today snapshot + last-7-days strip + monthly calendar with prev/next nav capped at current month.
- **Exam result** — circular % ring + grade + PASS/FAIL + per-term bar chart + weight-breakdown explainer + per-subject weighted % bars + detailed marksheet table + co-scholastic grades.
- **Fees** — summary card (outstanding due OR "All clear", quarterly installment, paid/total progress) + breakdown list (with sibling-discount strikethrough rows, hostel components if applicable, registration/admission/caution for new admissions) + payment history.
- **Diary & Homework** — per-day per-period cards with topic + homework.
- **Timetable** — full weekly grid (re-uses `tt_render_grid_html()` from the ERP).
- **Contact School** — curated staff chain: subject teachers (derived live from timetable, ordered by weekly load with class teacher pinned) + school office chain (Reception → Class Teacher → Coordinator → wing Headmistress → Vice Principal → Principal → Accountant → Hostel Warden (if hosteller) → Counsellor). Availability strip (on-call/before-call/closed) + Call (tel:) + WhatsApp (https://wa.me) with pre-filled mixed-script message.
- **More** — settings menu (iOS-style); Install Parent app row (PWA), privacy/terms links, Sign out.

**Open gap:** the parent portal's "Pay now" CTA exists on the home, but there is **no actual checkout endpoint** in the parent app — only the ERP-side payment-gateway *settings*. Port plan flags this as work-to-be-built, not work-to-be-ported.

---

## 6. Crestly Design System

Source: `erp/Crestly Design System.html` + runtime `assets/css/tokens.css` + `components.css`. **No dark mode.** "Theming" = per-school brand colour swap done server-side by overriding three CSS vars.

### 6.1 Tokens (exact values)

```css
/* Ink ramp */
--ink:#100D0A; --ink-90:#1A1714; --ink-80:#2A2520;
--ink-60:#4A4239; --ink-40:#7A7066; --ink-20:#B5ACA0;

/* Surfaces (light only) */
--white:#FFFFFF; --white-soft:#FAFAFA;
--paper:#FBF9F3; --cream-soft:#FAF6EC; --cream:#F5EFE3; --cream-deep:#EBE3D1;

/* Brand orange (overridden per tenant by school_brand_color()) */
--orange:#F25C19; --orange-deep:#C9460C; --orange-soft:#FF7B3D; --orange-tint:#FCE4D6;

/* Tints (icon squares + pill chips only) */
--tint-mint:#D6E8D9 / -deep:#3E7A50    success / active
--tint-peach:#F5DCC4 / -deep:#A65A22   archive
--tint-rose:#F5D6CE / -deep:#A03A28    financial totals
--tint-mustard:#EFE2BE / -deep:#7A5A18 primary counts
--tint-wheat:#F0E5C8 / -deep:#6E5418   session / class
--tint-sky:#D5E2EE / -deep:#27517E     info

/* Semantic (state only) */
--success:#1F6F4A / -soft:#DDEBE0
--warn:#C97A0A    / -soft:#F6E6C9
--error:#B83520   / -soft:#F4D9D2
--info:#2A5FA8    / -soft:#D6E1F0

/* Rules */
--rule:rgba(16,13,10,0.10); --rule-soft:rgba(16,13,10,0.06);
--rule-strong:rgba(16,13,10,0.18); --rule-onink:rgba(245,239,227,0.12);

/* Spacing */
--s-1:4 --s-2:8 --s-3:12 --s-4:16 --s-5:20 --s-6:24 --s-7:32 --s-8:48 --s-9:64 --s-10:96 (px)

/* Radii */
--r-1:4 --r-2:6 --r-3:8 (default) --r-4:12 --r-5:16 --r-pill:999 (px)

/* Shadows (use sparingly — borders are preferred) */
--shadow-1:0 1px 2px rgba(16,13,10,0.06)
--shadow-2:0 4px 14px -4px rgba(16,13,10,0.12)
--shadow-3:0 16px 40px -16px rgba(16,13,10,0.2)

/* Motion */
--ease: cubic-bezier(0.2,0.7,0.2,1); --t-fast:120ms; --t-med:200ms;
```

### 6.2 Typography

- **Fonts:** Geist 300/400/500/600/700/800/900 + Geist Mono 400/500/600 (Google Fonts). No third family.
- **Type scale:** `display-l` 56/800/-0.04em → `display-m` 36/700 → `display-s` 24/700 → `h1` 20/600 → `h2` 17/600 → `lede` 16/400/ink-60 → `body` 14/400 → `body-s` 13/400 → `label` mono 10.5/500/0.14em uppercase.
- **Body default:** 14px / 1.55 / `--ink`.

### 6.3 Brand dot

Every page title and most card titles end with an orange period: `<h1>Students<span class="brand-dot">.</span></h1>`. Implement as a primitive in `packages/design`.

### 6.4 Components inventory

- **Button** — `.btn` base; variants `--primary` (orange→cream), `--ink`, `--ghost` (white+border), `--success`, `--danger`; sizes `--sm` / `--lg`; modifiers `--icon-only`, `--full`; optional inline `.btn__count` chip.
- **Chip** / **Select** — pill (rectangular for select); `.is-active` flips ink+cream.
- **Field** — `.field` + `.field__label` (mono uppercase 10.5/0.12em) + `.input` (border ink, focus ring is a soft ink halo — never coloured) + `.input--area`, `.check`, `.search` (icon + input + kbd hint).
- **Pill** — base `.pill` (mono 10.5/600/0.12em uppercase, 3px×10px, radius pill) + 11 tone variants + optional `.pill__dot`.
- **Class pill** — `.cls-pill` wheat-tinted 11px mono.
- **Banner** — `.banner` (soft semantic bg + icon + msg + optional `.banner__link`); 4 tones.
- **Table card** — white card with CSS-grid rows; `.table-head` is cream-soft + mono 10.5 uppercase + 0.14em. Per-page hand-tuned grid templates.
- **Sidebar nav** — `.app__nav` 248px, sticky; brand block + session pill + collapsible `.nav-section` groups (one open at a time, persisted in localStorage); `.nav-item` (28×28 tinted icon + label + optional badge); `.user-block` at bottom.
- **Stat tile** — 40×40 tinted icon (6 tint colours) + mono label + display value (26/800) + mono delta.
- **Modal** — hand-rolled `.install-modal` pattern (scrim + sheet, bottom-sheet on mobile / centered above 600px, escape/scrim close, ARIA dialog/modal/hidden).
- **Toast** — *not formalized* in PHP; bake one for the React port.
- **Empty state** — *not formalized*; standardize as `<EmptyState icon title body action />`.
- **Print** — inline `@media print` per print page; no central print stylesheet.
- **App credit footer** — mono 11px `Powered by Shadowbiz Startups Developer` with orange `.app-credit__dot`; `padding-bottom: calc(22px + env(safe-area-inset-bottom))`.

### 6.5 Iconography

**Inline SVGs, never an icon font, never a library.** 24×24 grid, `stroke="currentColor"`, `stroke-width="1.75"` (NOT 2 — critical), `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none"`. Catalogue includes: users, check, x, user-plus, user-check, rupee, alert, info, dashboard, attendance, exam, ledger, voucher, calendar, settings, search, plus, chev-down, print, logout, menu, bell, msg, library.

Port plan: extract each `<svg>` path string into a typed `<Icon name="users" />` component under `packages/icons`. **Do not** swap to Lucide/Heroicons.

### 6.6 Layout

- **App shell:** desktop grid `248px 1fr`; sidebar sticky `100vh` white with `border-right: 1px solid var(--rule)`; main padding `28px 32px`, flex column gap 20px; background `--cream-soft`.
- **Hard breakpoint:** **960px**. ≤960: sidebar drops to off-canvas drawer + scrim; top bar appears; fixed bottom-nav appears (3 role-aware tabs + More); FAB sits bottom-right above the nav; app-credit gets `margin-bottom:72px` to clear the bottom nav.
- **Secondary breakpoints:** 600 (tile grids), 1024/1100/1200 (per-page table-column tweaks).
- **PWA:** `viewport-fit=cover` + `env(safe-area-inset-bottom)` + `screen.orientation.lock('portrait')` when standalone; manifest hard-codes portrait.

### 6.7 Per-tenant brand-colour override

Server-side: read `school_brand_color()` (validated `#hex`), inline a `<style id="school-theme">` block that overrides `--orange`, `--orange-deep`, `--orange-soft`. Logo + wordmark via `school_logo()` / `school_name()`. Port plan: emit the override in the React root layout from data fetched at JWT-validation time.

---

## 7. Cross-cutting concerns (port-time work)

### 7.1 PWA + service worker

- **Files:** `erp/sw.php` (served as `/erp/sw.js`), `manifest.json`, `offline.html`.
- **Strategy:** network-first for HTML (falls back to last cached, then `offline.html`), cache-first with background refresh for static assets; aggressive auto-update via versioned SW (version bytes include max mtime, so any deploy invalidates).
- **Auto-reload:** on `controllerchange` or `SW_ACTIVATED` postMessage.
- **Escape hatch:** `?sw=clear` URL flag nukes registrations + caches.
- **Port:** Vite + `vite-plugin-pwa` (Workbox); reuse `manifest.json` verbatim; mirror the strategy map; keep the escape hatch.

### 7.2 In-app notifications (NOT web push)

- **Table:** `notifications(id, user_id, type, title, body, link_url, read_at, created_at)` with 5-min de-dupe on `(user_id, type, link_url)`.
- **Surface:** sidebar bell with unread badge; `/notifications/index.php` inbox with mark-all-read.
- **Known types:** `voucher.pending_approval`, `voucher.approved`, `voucher.rejected`, `voucher.paid` (extendable by string convention `area.event`).
- **Port:** Node `notify()` helper; REST endpoint; React bell polling (or SSE). Web Push can be layered later.

### 7.3 WhatsApp integration (Meta Cloud API)

- **Per-tenant creds:** access_token, phone_number_id, waba_id, api_version (default `v22.0`), display_number, default_country (default `91`), enabled.
- **Flow:** admin syncs templates from Meta Graph → binds each action_key to a template + variable map → app calls `wa_dispatch(action_key, ctx)` which resolves recipient + vars + POSTs `{api_base}/{api_version}/{phone_number_id}/messages` → logs to `wa_message_log`.
- **Action catalogue (load-bearing — bindings already exist in production):** `fee.payment.received`, `fee.reminder`, `voucher.pending_approval`, `voucher.paid`, `student.absent`, `salary.paid`.
- **Port:** `lib/whatsapp.ts` with `dispatch(actionKey, ctx)` + a typed `WaContext` per action; never throw; consider BullMQ so a slow Meta response doesn't block the request.

### 7.4 Payment gateways (TWO of them — don't confuse)

1. **Razorpay** (platform-side) — used in `lib/feature_store.php` for admins paying Crestly to enable modules. Creds in platform `app_settings`. Verify via `hash_hmac('sha256', orderId + '|' + paymentId, keySecret)`.
2. **HDFC SmartGateway** (per-tenant) — *intended* for parents paying school fees. Creds in tenant `app_settings`, API key AES-256-CBC encrypted at rest (key derived from DB creds — port should use a dedicated `PG_KEK` env var instead). UAT endpoint `smartgatewayuat.hdfcbank.com`; prod `smartgateway.hdfcbank.com`. Two-leg flow: create attempt → redirect to hosted checkout → return + webhook → verify via `GET /orders/{id}` → reconcile to `fee_payments`. **Parent-side checkout endpoint is unfinished** in the PHP code — port plan completes this.

### 7.5 Importer

- **CSV-only** (port plan extends to XLSX via `xlsx` package).
- **Two entities:** staff, students.
- **Aliases dictionary** is the contract — keeps existing school CSVs working. Defined in `lib/importer.php` for both entities.
- **Validation:** name required; phone 10-digit; placeholder values `-`, `–`, `N/A`, `na`, blank → NULL. Default password = phone, bcrypt-hashed.
- **Flow:** preview (no commit) → commit (transactional).

### 7.6 Feature flags (platform-side)

- **Catalog:** `platform_features` rows (`is_core=1` always on).
- **Per-school:** `school_features` (if no rows → grandfathered, everything on; first explicit set materialises all flags).
- **Consumer surfaces:** sidebar visibility + hard URL gate (renders "Module not in your plan").
- **Known feature keys observed:** `online-fees` (gates Payment Gateway settings + parent checkout). Others read from `platform_features` rows.
- **Port:** `<FeatureGate keys="online-fees">` component + `requireFeature(...)` API middleware; cache the school's feature map per request.

### 7.7 Brand Studio (super-admin)

- **Brand Book** — static data in `superadmin/lib/brand_book.php`; HTML viewer + Markdown/ZIP download (palette.css + logos + README).
- **Prompt sets** — feature × format × tone × audience × theme → JSON-encoded slides in `brand_prompt_sets`. Mixed-script (Devanagari + Latin) pain→fix copy from `brand_feature_brief()`.
- **Brand images** — two providers: `local` (default, free; GD-based SVG composite — pebble decoration + middle band with feature screenshot or pebble placeholder + headline/logo overlay using bundled fonts) and `ideogram` (paid, API integration; downloads PNG, overlays brand text locally). Outputs in `/erp/uploads/brand/`.
- **Port:** Node port of the local composite engine using `sharp` + SVG; Ideogram integration is a straight HTTP call.

### 7.8 Backups

**Not in the codebase.** Handled at host level (cPanel/mysqldump cron). Port v1 leaves this to host ops; v2 can add an admin backups page.

---

## 8. Business logic catalogue (`erp/lib/*.php`)

30 modules. For each, the port creates a corresponding NestJS service. The exact public function signatures, data shapes, and dependencies are documented in `AUDIT-LIB.md` (extracted from the deep-scan; ~5000 words). High-level map:

| PHP file              | Node module                  | Owns                                                          |
| --------------------- | ---------------------------- | ------------------------------------------------------------- |
| `helpers.php`         | `common/helpers.ts`          | Phone/date/money/class helpers used everywhere                |
| `auth.php`            | `auth/auth.service.ts`       | login, current_user, permissions ✅ Phase 1                    |
| `tenant.php`          | `tenant/tenant.service.ts`   | Multi-tenant routing + crypto ✅ Phase 1                       |
| `nav.php`             | `nav/nav.service.ts`         | Role + feature-flag-aware sidebar + mobile bottom-nav         |
| `feature_store.php`   | `features/features.service.ts` | Catalog + Razorpay buy + activation                         |
| `classes.php`         | `classes/classes.service.ts` | Classes + sections + teacher assignment                       |
| `families.php`        | `families/families.service.ts` | Family CRUD + sibling-discount engine                       |
| `fees.php`            | `fees/fees.service.ts`       | Fee allotment + recompute totals + status engine              |
| `payments.php`        | `payments/payments.service.ts` | Receipt + receipt-no engine + void                          |
| `payment_gateway.php` | `payment-gateway/pg.service.ts` | HDFC SmartGateway: attempts + verify + webhook              |
| `vouchers.php`        | `vouchers/vouchers.service.ts` | Voucher state machine + approver flow + salary attribution  |
| `ledger.php`          | `ledger/ledger.service.ts`   | Expense aggregation + staff salary summary                    |
| `notifications.php`   | `notifications/notifications.service.ts` | In-app inbox + 5-min de-dupe                       |
| `whatsapp.php`        | `whatsapp/wa.service.ts`     | Meta Cloud API client + dispatch + log                        |
| `attendance.php`      | `attendance/att.service.ts`  | Student attendance + percent calc                             |
| `staff_attendance.php`| `staff-attendance/sa.service.ts` | Punch + geofence + selfie + outside flag                  |
| `holidays.php`        | `holidays/holidays.service.ts` | AY-aware list + working-days calc                           |
| `leaves.php`          | `leaves/leaves.service.ts`   | Apply + approve + balance calc                                |
| `salary.php`          | `salary/salary.service.ts`   | Daily salary ledger + paid-vs-due reconciliation              |
| `exams.php`           | `exams/exams.service.ts`     | Terms + subjects + datesheet + marks + co-scholastic + marksheet build |
| `timetable.php`       | `timetable/tt.service.ts`    | Periods + grid + conflict detect + smart-allot                |
| `diary.php`           | `diary/diary.service.ts`     | Per-day per-period log + parent visibility                    |
| `promotion.php`       | `promotion/promotion.service.ts` | Section-by-section promotion + finalise                   |
| `admissions.php`      | `admissions/admissions.service.ts` | Enquiry CRUD + follow-ups + convert-to-student           |
| `hostel.php`          | `hostel/hostel.service.ts`   | Rooms + allocations + fees                                    |
| `transport.php`       | `transport/transport.service.ts` | Pickup points + slabs + revenue                           |
| `daily_report.php`    | `daily-report/dr.service.ts` | Cash position per method + receipts + vouchers per day        |
| `edit_requests.php`   | `edit-requests/er.service.ts` | Student edit-request flow                                    |
| `dashboard_review.php`| `dashboard-review/dr.service.ts` | Per-user per-day checklist persistence                    |
| `importer.php`        | `import/import.service.ts`   | CSV preview + transactional commit (staff + students)         |

---

## 9. Permissions catalogue

Verified from grep `require_perm(`/`can(` + the 003 migration seed. Port plan keeps these strings verbatim so existing role-permission rows continue to work.

```
dashboard.view
students.view        students.manage      students.promote
classes.view         classes.manage
attendance.view      attendance.mark
fees.view            fees.manage
fee_structure.view   fee_structure.manage
team.view            team.manage          team.roles
leaves.apply         leaves.approve
exams.view           exams.enter_marks    exams.manage
ledger.view
vouchers.view_all    vouchers.create      vouchers.approve   vouchers.pay
timetable.view       timetable.manage
admissions.view      admissions.manage
diary.log
staff.punch          staff.view_all       staff.view_team
shifts.manage
whatsapp.configure   whatsapp.bind        whatsapp.logs
hr.dashboard
```

Per the 003 seed, the 5 system roles map to subsets of the above. Custom (non-system) roles are admin-defined in `team/roles.php`.

---

## 10. Gaps / risks flagged

These are things the user (or I) should know before porting. Each is non-blocking but needs a decision.

1. **Parent-side fee payment is unfinished.** ERP-side credentials page exists; parent-side checkout endpoint does not. Port plan completes it (HDFC SmartGateway, two-leg flow).
2. **`student_edit_requests` schema is inferred** (no CREATE TABLE in repo). Confirm against a live tenant DB before locking the Prisma model.
3. **PHP password_hash uses `$2y$`** but bcryptjs accepts `$2a$`/`$2b$`. Port has the prefix normaliser already in `apps/api/src/auth/auth.service.ts`.
4. **HDFC API key encryption KEK** is currently derived from the DB password — port should use a dedicated `PG_KEK` env var, which is a security upgrade (documented in `AUDIT.md` §7.4).
5. **Backups** aren't in the codebase. Host-level cron is the assumed solution. Out of scope for v1.
6. **Time zone:** PHP sets MySQL session timezone per connection from `school_info."Time Zone"`. Node port should read the same and set the per-tenant PrismaClient's session timezone on connect (otherwise existing date-bucketed reports drift by IST offset).
7. **Migration 025 wipes data.** Not relevant to schema port but reading it confirms which tables are considered "user data" (`students, users, attendance, exam_marks, …`). Useful for backup planning.
8. **`brand_prompt_sets.slides_json`, `wa_templates.components_json`, `feature_purchases.billing_*` are JSON-in-VARCHAR/TEXT** — Prisma can model as `String` but the port should validate with Zod on the way in/out.
9. **Two distinct Razorpay integrations exist** (platform feature-store + the historic `online-fees` flag) — they share no code. Keep them distinct in the port.

---

## 11. Execution plan — what comes next

Going to land batches sequentially in the existing `crestly-app/` repo. Each batch is **runnable code**, not just files: API endpoints + React routes + working forms wired to a real (or mocked) DB.

| Batch | Deliverable | Scope                                                                                                        | Estimated lines of TS |
| ----- | ----------- | ------------------------------------------------------------------------------------------------------------ | --------------------- |
| **A** | Foundation  | `packages/design` tokens + components matching CDS; `packages/icons`; full Prisma schema (56 tables); Sessions; Holidays; Classes/Sections; Streams; Families; **Students** (extend Phase 1 to full feature parity); Team/Roles/Permissions; Settings (general). UI shell matching CDS pixel-for-pixel. | ~12k |
| **B** | Daily driver | Attendance (auto-save + history calendar); Staff-attendance (punch with geo+selfie); Fee-ledger (list + payment + receipt print); Fee-structure (per-class + one-time + transport slabs + discounts); Diary; Timetable (grid + smart-allot + workload + periods); Daily-report (printable); Notifications (in-app inbox). | ~10k |
| **C** | Academic    | Exams (terms + subjects + datesheet + marks + co-scholastic + results + marksheet); Promotion (section + bulk + finalise); Admissions CRM (enquiries + follow-ups); Review-history; Approvals (edit-requests); Import (CSV preview + commit, staff + students). | ~8k |
| **D** | Finance & HR | Vouchers (create + approve + pay + attachments); Ledger (overview + staff salary); HR dashboard; Salary (per-user daily ledger); Leaves (apply + approve + balances); Shifts (bulk edit duty hours + salary); Punch (full UI with geofence + selfie). | ~7k |
| **E** | Operations  | Hostel (blocks + rooms + boarders + fees + schedule); Transport (pickup + slabs); Backups stub (admin-triggered mysqldump → download).                                                                       | ~3k |
| **F** | Cross-cutting | PWA + Workbox SW; in-app notification API + bell; WhatsApp dispatch (Meta Cloud) + settings UI + templates + log; HDFC SmartGateway parent checkout (two-leg + webhook); Razorpay feature-store. | ~5k |
| **G** | Super-admin app | `apps/superadmin/` — every page in §5.1 (Dashboard, Schools, Onboard, School detail, School features, Features & pricing, Pricing, Enquiries, Billing, Invoice, Ledger, Upgrades, Brand Studio, Brand settings, Brand guidelines, Admins, Account). | ~7k |
| **H** | Parent portal | `apps/parent/` — every page in §5.2, full PWA, multi-sibling switcher.                                                                                                                                      | ~4k |
| **I** | UI fidelity pass | Side-by-side check vs PHP screens; pixel-tweaks; print stylesheets; mobile drawer/bottom-nav polish; install banner.                                                                                       | ~1k |

Each batch is **landed and verifiable** before the next begins:
1. `npm run db:pull` against the real DB to confirm Prisma is in sync.
2. Diff against PHP screen visually (your job, my output).
3. Sign off, move on.

---

## 12. Sign-off checklist (before Batch A)

Confirm these and I start Batch A:

- [ ] **Target node-modules / DB access:** I assume you have local Node 20+ and access to the existing MySQL (the founding tenant). Yes/no?
- [ ] **`PLATFORM_KEY`:** the value in `superadmin/config.php` (`k9Qz3R7vM2pX8sB1nL6wH4tJ0yE5cA2dF7gU3iO9aP1mS4q`) goes verbatim into `apps/api/.env`. Confirm — or rotate now and re-encrypt existing `db_pass_enc` rows.
- [ ] **Brand colour:** ERP runs at `--orange:#F25C19` by default; tenant override via `school_brand_color()`. Confirm we keep this default.
- [ ] **Geist + Geist Mono** fonts from Google Fonts. Yes/no — or swap to a self-hosted variable font.
- [ ] **No dark mode.** Confirm.
- [ ] **Bottom-nav 3-tab + More** behaviour on mobile. Confirm we keep this layout.
- [ ] **Parent fee payment:** complete it as part of Batch F. Yes/no?
- [ ] **Backups:** out of v1 scope, host-level cron. Yes/no?

Once these are confirmed (or noted as "your call later"), I'll start Batch A — design tokens + full Prisma schema + Students full parity + Auth/Team/Roles/Permissions + Settings/Classes/Sections/Streams/Families/Holidays.
