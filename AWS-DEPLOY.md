# Deploying Crestly (api + web + superadmin) on AWS — single EC2

This deploys the whole stack on **one EC2 instance**:

- **API** (`apps/api`, NestJS) runs under PM2 on port 4000.
- **web** (`apps/web`) and **superadmin** (`apps/superadmin`) are built to static
  files and served by **Nginx**.
- Nginx also reverse-proxies `/api` and `/uploads` to the API, so each frontend
  talks to the API **same-origin** (no CORS config needed).
- **Databases stay on Hostinger MySQL.** No migration: `TenantService` rewrites
  tenant `db_host='localhost'` rows to the remote host from `DATABASE_URL`
  automatically. You only need to allow the EC2 IP in Hostinger Remote MySQL.

```
                        ┌───────────── EC2 (Ubuntu) ─────────────┐
app.crestly.in   ─────► │ Nginx ─ / → apps/web/dist (static)      │
                        │        ─ /api, /uploads → :4000 ───┐    │
admin.crestly.in ─────► │ Nginx ─ / → apps/superadmin/dist   │    │
                        │        ─ /api, /uploads → :4000 ──►├─ PM2 → node dist/main.js
                        └────────────────────────────────────┼────┘
                                                              │
                                          srv1274.hstgr.io ◄──┘  (Hostinger MySQL, remote)
```

---

## 0. DNS & domains (pick your subdomains)

- `app.crestly.in`   → web (school ERP)
- `admin.crestly.in` → superadmin
- (optional) `api.crestly.in` → only needed for the mobile app / external API clients

You'll point these at the EC2 Elastic IP in step 3.

---

## 1. Launch the EC2 instance

1. EC2 → Launch instance → **Ubuntu Server 22.04 LTS**.
2. Type: **t3.small** (2 GB, fine with the swap added in step 5) or **t3.medium**
   (4 GB, comfortable). The Vite builds are memory-hungry.
3. Key pair: create/download one for SSH.
4. **Security group** — allow inbound:
   - 22 (SSH) — ideally your IP only
   - 80 (HTTP)
   - 443 (HTTPS)
5. Storage: 20 GB gp3 is plenty.

## 2. Elastic IP

EC2 → Elastic IPs → Allocate → Associate with the instance. This gives a fixed
public IP that survives reboots.

## 3. Point DNS

In your DNS provider, add **A records** for `app`, `admin` (and `api` if used)
→ the Elastic IP.

## 4. Connect & install runtime

```bash
ssh -i your-key.pem ubuntu@ELASTIC_IP

sudo apt-get update && sudo apt-get upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx
sudo npm i -g pm2
node -v   # expect v20.x
```

## 5. Add swap (prevents out-of-memory during the build)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 6. Get the code & build everything

```bash
cd ~
git clone <your-repo-url> crestly      # or scp/upload your zip and unzip
cd crestly

npm ci
npm run build                          # builds shared + api + web + superadmin
```

- `npm run build` produces: `apps/api/dist`, `apps/web/dist`,
  `apps/superadmin/dist`, and runs `prisma generate`.
- On a real Linux box the `.bin` shims are executable, so the build "just works"
  (the Hostinger-specific permission issues do not occur here). The
  `scripts/run-bin.js` indirection is harmless and still works.
- Frontends are built with `VITE_API_BASE_URL` **unset** → they call same-origin
  `/api`, which Nginx proxies to the API. Nothing to configure.

## 7. Configure the API environment

Create `~/crestly/apps/api/.env`:

```ini
DATABASE_URL="mysql://u198647305_crestly_nmn:fdWF0nCi6Y%26@srv1274.hstgr.io:3306/u198647305_crestly_nmn"
PLATFORM_KEY="k9Qz3R7vM2pX8sB1nL6wH4tJ0yE5cA2dF7gU3iO9aP1mS4q"
DEFAULT_TZ="Asia/Kolkata"
JWT_SECRET="yCN9eg1NsmFgBG2pXre3gB76Qfy0a5CwFz1T3DQLxNf7MkWQiHgqi5FWRFUhBn64"
JWT_EXPIRES_IN="12h"
PORT=4000
CORS_ORIGIN="https://app.crestly.in,https://admin.crestly.in"
NODE_ENV="production"
```

- `DATABASE_URL` host **must stay `srv1274.hstgr.io`** (remote) — that's what makes
  the tenant `localhost`→remote override work.
- `CORS_ORIGIN` is belt-and-suspenders (same-origin proxy means CORS rarely fires),
  but set it to your real frontend domains.

## 8. Allow the EC2 IP in Hostinger Remote MySQL

hPanel → Databases → **Remote MySQL** → add the EC2 **Elastic IP** (or your DB may
already allow `%`/any host, in which case it's done). Without this, the API can't
reach the DB from AWS.

## 9. Start the API with PM2

```bash
cd ~/crestly/apps/api
pm2 start dist/main.js --name crestly-api      # cwd = apps/api, so uploads/ resolves
pm2 save
pm2 startup                                     # run the command it prints (sudo ...)
pm2 logs crestly-api --lines 50                 # expect "API listening ... /api"
```

> Run PM2 from `apps/api` so `process.cwd()` is `apps/api` — the API serves user
> uploads from `apps/api/uploads`.

## 10. Nginx — serve both SPAs + proxy the API

Create `/etc/nginx/sites-available/crestly`:

```nginx
# ---- web (school ERP) ----
server {
    listen 80;
    server_name app.crestly.in;
    root /home/ubuntu/crestly/apps/web/dist;
    index index.html;

    # SPA client-side routing
    location / { try_files $uri /index.html; }

    # API + uploads → Node (same origin, no CORS)
    location /api      { proxy_pass http://127.0.0.1:4000; include /etc/nginx/proxy_params; }
    location /uploads  { proxy_pass http://127.0.0.1:4000; include /etc/nginx/proxy_params; }

    client_max_body_size 12m;   # matches the API's 10mb body limit + headroom
}

# ---- superadmin ----
server {
    listen 80;
    server_name admin.crestly.in;
    root /home/ubuntu/crestly/apps/superadmin/dist;
    index index.html;

    location / { try_files $uri /index.html; }
    location /api      { proxy_pass http://127.0.0.1:4000; include /etc/nginx/proxy_params; }
    location /uploads  { proxy_pass http://127.0.0.1:4000; include /etc/nginx/proxy_params; }

    client_max_body_size 12m;
}
```

`/etc/nginx/proxy_params` already exists on Ubuntu (sets Host, X-Real-IP,
X-Forwarded-For/Proto). Then:

```bash
sudo ln -s /etc/nginx/sites-available/crestly /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

At this point HTTP should work: open `http://app.crestly.in`.

## 11. HTTPS with Let's Encrypt

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.crestly.in -d admin.crestly.in
# add -d api.crestly.in if you set that up
```

Certbot edits the Nginx files to add 443 + auto-redirect and sets up renewal.

## 12. Verify

- `https://app.crestly.in` → ERP login loads, can log in.
- `https://admin.crestly.in` → superadmin login.
- `https://app.crestly.in/api` → API base responds.
- `pm2 logs crestly-api` → no DB connection errors (confirms Hostinger Remote
  MySQL allows the EC2 IP and tenant resolution works).

---

## Redeploying later

```bash
cd ~/crestly
git pull
npm ci
npm run build
pm2 restart crestly-api
sudo systemctl reload nginx   # only needed if nginx config changed
```

## Optional: dedicated api.crestly.in (for the mobile app)

Add a third server block proxying everything to `127.0.0.1:4000`, certbot it, and
the React Native app points at `https://api.crestly.in`. The web/superadmin builds
don't need it (they use same-origin `/api`).

## Notes & alternatives

- **DB on RDS (future):** the multi-tenant model (per-school DBs referenced in
  `partner_schools`) makes an RDS migration a real project — defer it. Keeping the
  DBs on Hostinger and pointing AWS at them works today thanks to the host override.
- **S3 + CloudFront for frontends (scale):** instead of Nginx static, you can push
  `apps/web/dist` / `apps/superadmin/dist` to S3 behind CloudFront. More scalable,
  but then frontends are a different origin from the API → set
  `VITE_API_BASE_URL=https://api.crestly.in` at build time and configure CORS.
- **Managed (less ops):** Elastic Beanstalk (API) + Amplify (frontends) is an
  option, but the single-EC2 setup above is the simplest to reason about.
```
