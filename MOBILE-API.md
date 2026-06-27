# Crestly Mobile API — Calendar · Contact (Masked Calling) · Tests

API reference for building these three features into the mobile app. Every
endpoint here is **live** on the deployed API. If the mobile app is built in
TypeScript, you can `import { ... } from "@crestly/shared"` to get all the
request/response types for free — the names below match that package exactly.

---

## 0. Conventions

**Base URL.** All routes are under `/api` (e.g. `https://app.crestly.in/api`).
For a native app, point at `https://api.crestly.in` if you set up that
subdomain, else the same host as web.

**Auth.** Bearer JWT in the `Authorization` header. There are **two separate
token types** — don't mix them:

| Token | How to get it | Used for |
| ----- | ------------- | -------- |
| **Staff** | `POST /api/auth/login` `{ phone, password }` → `{ accessToken, user }` | `/calendar/*`, `/tests/*`, `/calling/*` |
| **Parent** | `POST /api/parent/login` `{ phone, dob }` (dob = `DDMMYYYY`) → `{ accessToken, kids[], ... }` | `/parent/*` |

```
Authorization: Bearer <accessToken>
```

A parent token encodes which children (`sr` numbers) it may access; every
`/parent/*` call takes the child as a `?sr=` query param and is rejected if
that `sr` isn't in the token.

**Formats.** Dates `YYYY-MM-DD`, month `YYYY-MM`, time-of-day `HH:MM` (24h),
timestamps ISO-8601. Money is integer rupees.

**Errors.** Non-2xx returns `{ message, issues? }` where `issues` is a Zod
array `[{ path, message }]` pinpointing bad fields. 401 = token missing/expired,
403 = wrong scope/permission.

---

## 1. School Calendar

One **merged feed** — your events + holidays + exam datesheets — as a flat,
date-sorted list. You render a month/agenda; each item says which source it's
from and whether it's editable.

### 1.1 Parent (read) — `GET /api/parent/calendar`  *(parent token)*

Query: `sr` (child), and `month=YYYY-MM` **or** `from`/`to=YYYY-MM-DD`.
Omitting all three defaults to the current month. Feed is scoped to the
child's class and to parent-visible entries only.

**Response — `CalendarFeedResponse`:**
```jsonc
{
  "from": "2026-06-01",
  "to": "2026-06-30",
  "items": [
    {
      "key": "event:12",          // stable composite id across sources
      "source": "event",          // "event" | "holiday" | "exam"
      "refId": 12,                // row id within its source table
      "title": "Annual Sports Day",
      "category": "sports",       // see category list below
      "date": "2026-06-18",
      "endDate": null,            // multi-day events only
      "startTime": null,          // "HH:MM" when not all-day
      "endTime": null,
      "allDay": true,
      "isHoliday": false,         // true = non-working day (grey it out)
      "audience": "all",          // "all" | "staff" | "parents"
      "classLabel": null,         // null = school-wide
      "location": "Main Ground",
      "color": null,
      "editable": false           // parents never edit
    }
  ]
}
```

`category` ∈ `event, ptm, function, activity, sports, exam, fee, meeting,
notice, holiday, other`.

### 1.2 Staff (manage) — *(staff token)*

| Method | Path | Body / Query | Returns |
| ------ | ---- | ------------ | ------- |
| GET | `/api/calendar/feed` | `month` **or** `from`/`to`; `classSlug?`, `includeHolidays?`, `includeExams?` (`true`/`false`) | `CalendarFeedResponse` |
| GET | `/api/calendar/events` | `session?` | `CalendarEvent[]` (raw, editable only) |
| GET | `/api/calendar/events/:id` | — | `CalendarEvent` |
| POST | `/api/calendar/events` | `CalendarEventUpsert` | `CalendarEvent` |
| PUT | `/api/calendar/events/:id` | `CalendarEventUpsert` | `CalendarEvent` |
| DELETE | `/api/calendar/events/:id` | — | `{ ok: true }` |

**`CalendarEventUpsert`** (defaults shown):
```jsonc
{
  "title": "Parent–Teacher Meeting",  // required, ≤160
  "description": null,                 // ≤1000
  "category": "ptm",                   // default "event"
  "startDate": "2026-07-10",           // required
  "endDate": null,
  "startTime": "10:00",                // ignored when allDay
  "endTime": "13:00",
  "allDay": false,                     // default true
  "isHoliday": false,
  "audience": "all",                   // default "all"
  "classSlug": "6",                    // null = school-wide
  "location": "Auditorium",
  "color": null,
  "sessionCode": "2025-26"             // optional, defaults to current session
}
```

---

## 2. Contact + Masked Calling

The contact screen lists subject teachers + the school chain (reception,
coordinator, principal, accountant, …). Two privacy rules drive the UI, both
enforced server-side:

- **Office-hours gating** — `canCallNow` is `true` only inside that staffer's
  call window. Outside it, show **WhatsApp only**.
- **Masked calling** — when configured (`callingEnabled: true` / per-staff
  `callMasked: true`), **`phone` comes back `null`** and you place the call via
  the API; the provider bridges both legs behind the ExoPhone. WhatsApp routes
  to the school's number (`schoolWhatsapp`), never a personal one.

### 2.1 `GET /api/parent/contact?sr=`  *(parent token)*

**Response — `ParentContactResponse`:**
```jsonc
{
  "srNumber": 1234,
  "classLabel": "6-A",
  "office": {
    "isOpen": true,
    "opensAt": "08:00",
    "closesAt": "16:00",
    "hoursLabel": "Mon–Sat 8 AM – 4 PM",
    "label": "Open now · closes 4:00 PM"
  },
  "callingEnabled": true,            // masked calling configured for this school
  "schoolWhatsapp": "9198xxxxxxxx",  // after-hours channel; null if WA not set up
  "subjectTeachers": [ /* ParentContactStaff[] */ ],
  "schoolChain":     [ /* ParentContactStaff[] */ ]
}
```

**`ParentContactStaff`:**
```jsonc
{
  "id": 42,                  // users.id — pass as staffId to place a call
  "roleLabel": "Class Teacher",
  "name": "Asha Verma",
  "designation": "PGT Maths",
  "phone": null,             // null when callMasked = true (never exposed)
  "whatsapp": "9198xxxxxxxx",// personal WA; use schoolWhatsapp when masked
  "callStart": "09:00",
  "callEnd": "15:00",
  "canCallNow": false,       // false → disable call, show WhatsApp only
  "callMasked": true,        // true → call via API, not tel:
  "subjects": ["Mathematics"],
  "isClassTeacher": true
}
```

### 2.2 Place a masked call — `POST /api/parent/contact/call`  *(parent token)*

Body `MaskedCallRequest` → Result carries **no phone numbers**:
```jsonc
// request
{ "sr": 1234, "staffId": 42 }
// response — MaskedCallResult
{ "ok": true, "callId": "abc123", "status": "ringing", "message": null }
```
On `ok:true` the parent's phone rings first, then the staffer's; both see the
ExoPhone. Show a toast like *"Connecting… your phone will ring."*

### 2.3 Client button logic

```
if (staff.callMasked) {
  // Call button → POST /parent/contact/call {sr, staffId}
  // enabled only when staff.canCallNow
} else {
  // Call → tel:staff.phone, enabled only when staff.canCallNow
}
// WhatsApp (always available):
const wa = staff.callMasked ? schoolWhatsapp : staff.whatsapp;
// → https://wa.me/<digits of wa>
```

### 2.4 Staff settings — *(staff token; admin screen, optional in mobile)*

| Method | Path | Body | Returns |
| ------ | ---- | ---- | ------- |
| GET | `/api/calling/settings` | — | `CallingSettings` (secrets masked) |
| PUT | `/api/calling/settings` | `CallingSettingsUpdate` | `CallingSettings` |
| POST | `/api/calling/settings/test` | — | `CallingTestResult` `{ ok, error? }` |

Secret write-through (like AI settings): omit `apiKey`/`apiToken` to keep
existing, `""` to clear, any string to overwrite.

---

## 3. Tests — MCQ + Fill-in-the-blanks

Teachers author + publish; students attempt via the parent token; answers are
**auto-graded on submit**. The answer key is never sent to the student before
submission, and is revealed in the graded result afterward.

### 3.1 Parent / student flow  *(parent token)*

**List — `GET /api/parent/tests?sr=`** → `ParentTestListResponse`:
```jsonc
{
  "srNumber": 1234,
  "tests": [
    {
      "id": 7,
      "title": "Unit Test 1 — Fractions",
      "subjectName": "Mathematics",
      "totalMarks": 10,
      "questionCount": 8,
      "durationMin": 20,
      "availableFrom": null,
      "availableTo": null,
      "state": "available",   // "available" | "upcoming" | "closed" | "attempted"
      "score": null           // set when state = "attempted"
    }
  ]
}
```
Render `available` → Start; `attempted` → show `score/totalMarks`;
`upcoming`/`closed` → disabled.

**Open — `GET /api/parent/tests/:id?sr=`** → `ParentTestDetail` (no answer key):
```jsonc
{
  "id": 7, "title": "Unit Test 1 — Fractions", "instructions": "Answer all.",
  "subjectName": "Mathematics", "durationMin": 20, "totalMarks": 10,
  "alreadyAttempted": false,
  "questions": [
    { "id": 101, "type": "mcq", "prompt": "1/2 + 1/4 = ?", "marks": 1,
      "options": [{ "text": "3/4" }, { "text": "1/6" }, { "text": "2/6" }] },
    { "id": 102, "type": "fill_blank", "prompt": "Half of 10 is ___", "marks": 1,
      "options": null }
  ]
}
```

**Submit — `POST /api/parent/tests/:id/submit`** body `TestSubmitInput`:
```jsonc
{
  "sr": 1234,
  "answers": [
    { "questionId": 101, "selectedOptions": [0] },   // MCQ: option indices
    { "questionId": 102, "responseText": "5" }        // fill_blank: typed text
  ]
}
```
→ `TestSubmitResult` (graded, key revealed):
```jsonc
{
  "testId": 7, "srNumber": 1234, "score": 9, "maxScore": 10, "percent": 90,
  "submittedAt": "2026-06-26T11:40:00.000Z",
  "answers": [
    { "questionId": 101, "type": "mcq", "prompt": "1/2 + 1/4 = ?",
      "marks": 1, "awardedMarks": 1, "isCorrect": true,
      "selectedOptions": [0], "responseText": null,
      "correctOptions": [0], "acceptedAnswers": null }
  ]
}
```
One attempt per child per test — `alreadyAttempted: true` (or `state:"attempted"`)
means don't let them re-submit; show the score instead.

**Grading rules** (so the mobile UI matches the server):
- **MCQ** — correct only if the selected set **exactly equals** the correct set
  (handles multi-correct; order doesn't matter; extra or missing = wrong).
- **fill_blank** — trims whitespace, matches against any accepted answer;
  case-insensitive unless the question was authored case-sensitive.
- Per-question marks are all-or-nothing.

### 3.2 Staff authoring  *(staff token)*

| Method | Path | Body | Returns |
| ------ | ---- | ---- | ------- |
| GET | `/api/tests` | `?status=&classSlug=&sessionCode=` | `TestListItem[]` |
| GET | `/api/tests/:id` | — | `Test` (incl. answer key) |
| POST | `/api/tests` | `TestUpsert` | `Test` |
| PUT | `/api/tests/:id` | `TestUpsert` | `Test` (blocked once attempts exist) |
| POST | `/api/tests/:id/publish` | — | `Test` |
| POST | `/api/tests/:id/close` | — | `Test` |
| DELETE | `/api/tests/:id` | — | `{ ok: true }` |
| GET | `/api/tests/:id/results` | — | `TestResultsResponse` |

**`TestUpsert`** (key parts):
```jsonc
{
  "title": "Unit Test 1", "classSlug": "6", "sectionCode": null,
  "subjectId": 3, "durationMin": 20, "shuffle": false,
  "questions": [
    { "type": "mcq", "prompt": "1/2 + 1/4 = ?", "marks": 1,
      "options": [{ "text": "3/4" }, { "text": "1/6" }],
      "correctOptions": [0] },
    { "type": "fill_blank", "prompt": "Half of 10 is ___", "marks": 1,
      "acceptedAnswers": ["5", "five"], "caseSensitive": false }
  ]
}
```

---

## 4. Quick reference — `@crestly/shared` types

| Feature | Request types | Response types |
| ------- | ------------- | -------------- |
| Calendar | `CalendarEventUpsert`, `CalendarFeedQuery` | `CalendarFeedResponse`, `CalendarFeedItem`, `CalendarEvent` |
| Contact  | `MaskedCallRequest`, `CallingSettingsUpdate` | `ParentContactResponse`, `ParentContactStaff`, `ParentOfficeStatus`, `MaskedCallResult`, `CallingSettings`, `CallingTestResult` |
| Tests    | `TestUpsert`, `TestSubmitInput`, `TestListQuery` | `Test`, `TestListItem`, `TestResultsResponse`, `ParentTestListResponse`, `ParentTestDetail`, `TestSubmitResult`, `GradedAnswer` |

Endpoint-by-endpoint backend notes (auth realms, table layout, Exotel setup)
live in [FEATURES.md](FEATURES.md).

---

## 5. Additions (2026-06-27)

### Tests — passing marks
`TestUpsert` accepts an optional **`passMarks`** (integer, ≤ total). These read
shapes now carry it:
- `Test`, `TestListItem` → `passMarks: number | null`
- `TestResultsResponse` → `passMarks`; each `TestResultRow` → `passed: boolean | null`
- `ParentTestListItem` → `passMarks`, `passed`
- `TestSubmitResult` → `passMarks`, `passed`

`passed` = `score >= passMarks`; it's `null` when no pass mark is set or the test
isn't yet submitted. Render Pass/Fail only when `passed != null`.

### Tests — import questions (staff)
`POST /api/tests/parse-questions` *(staff token)*
```jsonc
// request
{ "text": "What is 2+2? [1]\n- 3\n* 4\n- 5", "format": "auto" }  // format: auto | text | csv
// response
{ "questions": [ /* TestQuestionUpsert[] — feed straight into the create form */ ],
  "errors":    [ "Q2 \"...\": MCQ needs at least 2 options." ] }
```
Server-side parse only; the teacher reviews `questions` then POSTs `/tests`.
Mobile can offer a "paste to import" box and reuse this.

### Attendance — class-teacher scope
`GET /api/attendance/my-classes` *(staff token)* →
```jsonc
{ "canMarkAll": false,
  "classes": [ { "classSlug": "6", "className": "Class 6", "sectionCode": "A" } ] }
```
Drive the class/section picker from this. A class teacher gets only their own
section(s); `canMarkAll: true` (admins/principal) returns every section.
`roster`, `mark`, and `bulk` all reject a class/section outside this list with
**403** — so the mobile UI should only ever offer what `my-classes` returns.
