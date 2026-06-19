# Crestly

TypeScript rewrite of the Crestly school ERP (originally PHP). Monorepo with a NestJS API, a React web client, and a shared package for Zod schemas / DTOs. A React Native mobile app will join later and reuse `packages/shared` plus the same API.

This is **Phase 1**: the project is scaffolded and the **Students** module is ported end-to-end as the reference pattern. The remaining ~30 PHP modules will be ported against this template.

## Stack

| Layer       | Choice                                                     |
| ----------- | ---------------------------------------------------------- |
| API         | Node 20 · NestJS 10 · Prisma 5 · MySQL · JWT (Passport)    |
| Web         | Vite 5 · React 18 · TypeScript · Tailwind · shadcn-style UI · TanStack Query |
| Shared      | Zod schemas + types, consumed by api / web / mobile        |
| Tooling     | npm workspaces                                             |

## Layout

```
crestly-app/
├── apps/
│   ├── api/                   NestJS backend
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   │       ├── auth/          login, JWT, guards, @RequirePerm
│   │       ├── tenant/        platform DB + per-school PrismaClient factory
│   │       ├── prisma/        request-scoped PrismaClient binding
│   │       ├── students/      reference module (controller + service)
│   │       └── common/        ZodPipe, etc.
│   └── web/                   React web client
│       └── src/
│           ├── pages/         LoginPage, students/*
│           ├── layouts/       AppShell (sidebar + topbar)
│           ├── components/ui  Button, Input, Card, Label
│           └── lib/           api client, auth store
└── packages/
    └── shared/                Zod schemas + types (LoginInput, Student, …)
```

## Prerequisites

- **Node 20.10+** (ships with npm 10+, which supports workspaces)
- **MySQL** access to the existing Crestly database

## Install

```bash
cd crestly-app
npm install
```

`npm install` hoists everything to the root `node_modules/` and symlinks workspace packages, so `@crestly/shared` resolves to the local source automatically.

## Configure

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

`apps/api/.env` keys:

| Var             | Notes |
| --------------- | ----- |
| `DATABASE_URL`  | mysql:// pointing at the **platform DB** (the founding school). The API will discover tenants from `partner_schools` and open per-tenant connections from there. |
| `PLATFORM_KEY`  | Must match `superadmin/config.php` PLATFORM_KEY **byte for byte**, or encrypted DB passwords won't decrypt. |
| `JWT_SECRET`    | 48+ random chars: `openssl rand -base64 48` |
| `CORS_ORIGIN`   | Web origin (default `http://localhost:5173`) |

## Sync the Prisma schema

`prisma/schema.prisma` ships with the tables needed for Phase 1 (auth, partner_schools, students, sessions, fees). The legacy PHP project has 30+ more tables added across `erp/sql/migrations/*`. After connecting to a real DB, introspect them in:

```bash
npm run db:pull        # writes new models into schema.prisma
npm run db:generate    # regenerate @prisma/client
```

## Run

Both apps together (uses `concurrently`):

```bash
npm run dev
```

Or in separate terminals:

```bash
npm run dev:api        # http://localhost:4000/api
npm run dev:web        # http://localhost:5173
```

## Login

The login flow mirrors the PHP `login_user()` function:

1. POST `/api/auth/login` with `{ phone, password }`.
2. The API iterates every **active** row in `partner_schools`, decrypts each row's DB password, and tries the phone+password against that school's `users` table.
3. First school whose bcrypt hash verifies wins. The response is `{ accessToken, user }`.
4. The web client stores the token in `localStorage` and sends it on every request as `Authorization: Bearer …`.

PHP-issued `$2y$` bcrypt hashes are accepted — the API normalises them to `$2a$` before verifying so existing user passwords keep working without a forced reset.

## Permissions

Every protected route uses `@RequirePerm('module.action')`, the Nest equivalent of the PHP helper `require_perm()`. Perms come from the user's role via `role_permissions`. Example:

```ts
@Get()
@RequirePerm("students.view")
list(...) { ... }
```

The web's `<AppShell>` hides nav entries the user lacks; the API enforces them.

## Adding the next module (template)

Follow the Students module as the template:

1. **Shared** — add a Zod schema in `packages/shared/src/<module>.ts` and re-export from `index.ts`.
2. **Prisma** — model the table in `apps/api/prisma/schema.prisma` (or `npm run db:pull`).
3. **API** — create `apps/api/src/<module>/` with `*.module.ts`, `*.controller.ts`, `*.service.ts`. Use `RequestPrismaService` for tenant-scoped queries. Register the new `*Module` in `app.module.ts`.
4. **Web** — add a `hooks.ts` (TanStack Query) and pages under `apps/web/src/pages/<module>/`. Register routes in `App.tsx` and a nav item in `AppShell`.

## Phased roadmap

- **Phase 1 (now)** — monorepo, auth, multi-tenant routing, Students. ✅
- **Phase 2** — port high-traffic modules: Attendance, Fee-ledger, Exams, Timetable.
- **Phase 3** — Admissions, Promotion, HR/Salary, Hostel, Transport, Vouchers.
- **Phase 4** — Super-admin app, Parent portal (separate web app reusing the same API + `packages/shared`).
- **Phase 5** — React Native mobile app (parent/teacher).

## Notes for the port

- Students PK is `sr_number` (admission roll number), **not** an autoincrement surrogate. Admission flow sets it explicitly.
- The PHP app sets MySQL session timezone per connection from `school_info."Time Zone"`. For Node, we set `DEFAULT_TZ` env and let Prisma/Node Date handle UTC; we should add a per-tenant `SET time_zone` on connection if existing reports depend on it.
- The PHP app never hard-deletes students — `DELETE /students/:sr` here soft-flips `status` to `inactive`, matching that contract.
