# Deploying the Crestly API on Hostinger (Node.js app)

This deploys **`apps/api`** — a NestJS server (Prisma + MySQL) — using Hostinger's
hPanel **Node.js app** feature, against the existing **shared MySQL** database.

> This is an npm-workspaces **monorepo**. `apps/api` depends on `@crestly/shared`,
> which must be built first. So the Node.js app must be rooted at the **repo root**,
> not at `apps/api`. The build ordering is already handled by the root `package.json`.

---

## 1. hPanel → Node.js app settings

| Field | Value |
|---|---|
| **Application root** | the repo root (folder containing the top-level `package.json` with `"workspaces"`) |
| **Node version** | 20.x (the repo's `engines` requires Node ≥ 20.10) |
| **Install command** | `npm ci` |
| **Build command** | `npm run build:api` |
| **Startup file** | `apps/api/dist/main.js` |

Notes:
- `npm run build:api` builds **only** `@crestly/shared` then the API (skips the
  `web`/`superadmin` frontends, which the backend doesn't need). It runs
  `prisma generate` via the API's `prebuild` hook. Nothing to chain manually.
- Build steps invoke compilers through `scripts/run-bin.js` instead of the
  `.bin/` shims, because Hostinger's build sandbox (a) installs the shims without
  the executable bit (`tsc: Permission denied`, exit 126) and (b) builds the
  source in `.builds/source/` while `node_modules` lives at the `public_html`
  root, reachable only via `PATH` (so plain `require` throws MODULE_NOT_FOUND).
  `run-bin.js` derives `node_modules` from `PATH` and runs the tool in-process.
- The app reads `process.env.PORT`, so Hostinger's assigned port is used
  automatically. **Do not hardcode a port** in production.

---

## 2. Environment variables (set in the Node.js app panel, not a .env file)

```
DATABASE_URL    mysql://u198647305_crestly:<URL-ENCODED-PASSWORD>@localhost:3306/u198647305_crestly
PLATFORM_KEY    <must match superadmin/config.php PLATFORM_KEY exactly>
DEFAULT_TZ      Asia/Kolkata
JWT_SECRET      yCN9eg1NsmFgBG2pXre3gB76Qfy0a5CwFz1T3DQLxNf7MkWQiHgqi5FWRFUhBn64
JWT_EXPIRES_IN  12h
CORS_ORIGIN     https://your-frontend-domain.com
NODE_ENV        production
```

### DATABASE_URL details
1. **Host is `localhost`** — when the Node app and shared MySQL DB live on the same
   Hostinger account, you connect over localhost (no Remote MySQL needed).
2. **URL-encode special characters in the password.** Examples:
   `:` → `%3A`, `@` → `%40`, `>` → `%3E`, `/` → `%2F`, `#` → `%23`.
   e.g. password `s:O0V>kL` becomes `s%3AO0V%3EkL`.

### JWT_SECRET
A fresh 48-byte secret was generated above and placed in the table — you can use it
as-is, or regenerate with: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`

### CORS_ORIGIN
Set this to your real frontend URL(s). Comma-separate multiple origins. If this is
wrong, the browser blocks all API calls.

---

## 3. Deploy

1. Upload/push the code to the application root (Git deploy or file manager).
2. Run **Install** → **Build** → **Start/Restart** from hPanel.
3. Watch the app logs for: `API listening on http://localhost:<port>/api`.
4. Test the base URL — the global route prefix is `/api`:
   `https://<your-app-url>/api`

---

## 4. Important notes

- **No database migrations.** This project uses `prisma db pull` (introspection);
  the schema already exists in MySQL. Do **NOT** run `prisma migrate deploy`.
- **Uploads directory.** `apps/api/uploads/` holds runtime user files (selfies,
  attachments). Ensure it's writable and persists across redeploys.
- **Build memory.** On the smallest shared plans the monorepo build can hit memory
  limits. If the build hangs/fails, build locally (`npm ci && npm run build`) and
  upload the `dist/` folders, or move to a VPS.

## 5. Redeploying later

After uploading new code, just re-run **Install → Build → Restart** in hPanel.
The `prebuild` hook re-generates the Prisma client every build.
