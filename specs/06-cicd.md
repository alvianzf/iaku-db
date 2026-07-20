# 06 — CI/CD & Deployment

Target: `iaku.alvianzf.id` → Cloudflare → Ubuntu host `43.159.55.204`.

Replaces the current Vercel deploy (`vercel.json`). Vercel serves static files
only and cannot host the Express API, so the whole app moves to the VPS.

## Authentication to the host: keys, not the password

A username/password was supplied for the server. **The pipeline will not use
it**, for three reasons that are worth stating rather than assuming:

1. A password in GitHub Actions is a long-lived secret that any workflow — and
   anyone who can open a PR that touches a workflow — may be able to reach.
2. `43.159.55.204:22` is publicly routable. Password auth there is
   continuously brute-forced by background internet scanning; a key is not
   guessable.
3. A deploy key can be revoked by deleting one line from
   `authorized_keys`, without changing how humans log in.

### Setup (run once, manually, on the host)

```bash
# On a workstation — a dedicated key for CI, not a personal key
ssh-keygen -t ed25519 -C "github-actions-iaku" -f ~/.ssh/iaku_deploy -N ""

# Install the public half
ssh-copy-id -i ~/.ssh/iaku_deploy.pub ubuntu@43.159.55.204
```

Then **harden sshd** — this is the step that makes the above worth doing:

```
# /etc/ssh/sshd_config
PasswordAuthentication no
PermitRootLogin no
```

`sudo systemctl restart ssh`. Keep an existing session open while testing the
new one, or a bad config locks you out of the box.

The private key goes into GitHub as the secret `SSH_PRIVATE_KEY`. It never
touches the repo.

**Rotate the supplied password regardless** — it was transmitted in plaintext.
See [07](./07-security.md).

## Cloudflare

DNS: `iaku` → `A` → `43.159.55.204`, **proxied** (orange cloud).

### SSL/TLS mode must be Full (strict)

Cloudflare's default "Flexible" mode encrypts browser→Cloudflare but sends
**plain HTTP** Cloudflare→origin. The padlock appears while session cookies and
alumni phone numbers cross the internet in cleartext — the worst outcome,
because it looks secure.

Use **Full (strict)** with a Cloudflare Origin Certificate installed on nginx
(free, 15-year validity, trusted by Cloudflare specifically). Origin
Certificates are only valid for Cloudflare-proxied traffic, which is correct
here.

Then enable **Always Use HTTPS** and set **Min TLS 1.2**.

### `trust proxy`, or rate limiting silently breaks

Behind Cloudflare, every request arrives from a Cloudflare edge IP. `req.ip`
returns that edge IP, so:

- All the per-IP rate limits in [04](./04-api.md#rate-limits) collapse into a
  single shared bucket. A handful of users trip the login limit and lock out
  everyone else.
- Logs record Cloudflare IPs, making abuse impossible to trace.

The real client IP is in `CF-Connecting-IP`. Fix:

```js
app.set('trust proxy', true);
```

with nginx forwarding `X-Forwarded-For`, **and** restricting the origin firewall
to Cloudflare's published IP ranges. That last part is not optional: with
`trust proxy` on and the port open to the world, anyone can spoof
`X-Forwarded-For` and bypass rate limiting entirely. `trust proxy` is only safe
when the proxy is the sole possible source of traffic.

### Cache rules

Cloudflare must not cache the API. Add a rule: `iaku.alvianzf.id/api/*` →
**Bypass cache**. Without it, a cached `/api/auth/me` can serve one user's
session payload to another — a serious and confusing bug.

Static assets under `/assets/*` are content-hashed by Vite and should be cached
aggressively. `index.html` must **not** be, or deploys will not take effect for
returning visitors.

## Host layout

```
/var/www/iaku/          # static build output, served by nginx
/opt/iaku/server/       # API source + node_modules
/opt/iaku/shared/.env   # secrets, chmod 600, NOT in the repo
```

### nginx

```nginx
server {
  listen 443 ssl http2;
  server_name iaku.alvianzf.id;

  ssl_certificate     /etc/ssl/cloudflare/iaku.pem;
  ssl_certificate_key /etc/ssl/cloudflare/iaku.key;

  root /var/www/iaku;

  location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
  location = /index.html { add_header Cache-Control "no-cache"; }

  location / { try_files $uri $uri/ /index.html; }   # SPA fallback
}
```

The `try_files` line is the nginx equivalent of the existing `vercel.json`
rewrite — without it, deep links like `/dashboard` 404 on refresh.

### pm2

```bash
pm2 start server/src/index.js --name iaku-api
pm2 save && pm2 startup     # survives reboot
```

## Workflow

`.github/workflows/deploy.yml`, on push to `main`.

```yaml
name: Deploy
on:
  push: { branches: [main] }

concurrency:
  group: deploy-production
  cancel-in-progress: false
```

`concurrency` matters: two overlapping deploys can interleave rsync and
`prisma migrate` and leave the host in a state that matches no commit.
`cancel-in-progress: false` lets the running deploy finish rather than being
killed mid-migration.

### Jobs

**1. `verify`** — runs on every push *and* every PR:

```
npm ci
npm run lint
npm test              # phone normalisation tests are the critical ones
npm run build
```

A red build must block deployment. Note that `npm test` has no script today and
no test runner is installed — adding Vitest is part of the implementation, and
without it this gate is decorative.

**2. `deploy`** — `needs: verify`, `if: github.ref == 'refs/heads/main'`:

1. Build the client with `VITE_API_URL` unset (same-origin `/api`).
2. `webfactory/ssh-agent` with `SSH_PRIVATE_KEY`.
3. `rsync -az --delete dist/ ubuntu@host:/var/www/iaku/`
4. `rsync -az --delete server/ ubuntu@host:/opt/iaku/server/` (excluding
   `node_modules`, `.env`)
5. Over SSH: `npm ci --omit=dev`, then `npx prisma migrate deploy`, then
   `pm2 reload iaku-api`.
6. Purge the Cloudflare cache for `index.html` via API.
7. Smoke test: `curl -f https://iaku.alvianzf.id/api/health` — fail the job on
   non-200.

`prisma migrate deploy` (not `migrate dev`) is the production command: it
applies committed migrations and never generates or resets.

`pm2 reload` rather than `restart` — reload is zero-downtime.

### Migrations are the risky step

`migrate deploy` runs **before** the new code is live, so a migration that drops
or renames a column breaks the still-running old process. For destructive
schema changes, use the expand/contract pattern: deploy the additive migration
and new code first, remove the old column in a later deploy.

There is no automatic rollback. `pm2` keeps the previous release only if the
rsync did not overwrite it — so **take a DB backup before any migration**, as a
step in the workflow, not a habit.

## Secrets

| GitHub secret | Purpose |
|---|---|
| `SSH_PRIVATE_KEY` | Deploy key |
| `SSH_HOST` / `SSH_USER` | `43.159.55.204` / `ubuntu` |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ZONE_ID` | Cache purge |

`DATABASE_URL` and `JWT_SECRET` live **only** in `/opt/iaku/shared/.env` on the
host, not in GitHub. CI never needs them: `migrate deploy` runs over SSH on the
host, where the env file already is. Fewer copies of a credential is fewer
places to leak it.

## Firewall

```
ufw allow 22/tcp          # consider restricting to a known IP
ufw allow 443/tcp from <cloudflare ranges only>
ufw deny 3000             # API is reachable only via nginx on localhost
```

Port 3000 must never be exposed: reaching it directly bypasses nginx, and with
`trust proxy` enabled it also bypasses rate limiting.

## Success criteria

1. `https://iaku.alvianzf.id` serves the app with a valid certificate.
2. `curl http://iaku.alvianzf.id` redirects to HTTPS.
3. `ssh ubuntu@43.159.55.204` with a password is **refused**.
4. `curl https://43.159.55.204:3000` from outside the host times out.
5. A push to `main` deploys within ~5 min and the smoke test passes.
6. A failing test blocks the deploy job.
7. Server logs show real visitor IPs, not Cloudflare IPs.
8. Two rapid pushes queue rather than interleave.
9. Hard-refreshing `/dashboard` loads the app, not a 404.
