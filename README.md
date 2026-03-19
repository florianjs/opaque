# opaque

> A self-hosted secrets vault for AI-agent workflows.
> Secrets live on the server — never in `.env` files, never in LLM context.
> Any project authenticates with a single Ed25519 keypair. One env var. Zero leaks.

```
Developer manages secrets via dashboard or CLI
        ↓
Vault stores them encrypted at rest (AES-256-GCM)
        ↓
Your app authenticates with ONE env var: OPAQUE_PRIVATE_KEY
        ↓
At boot, app signs a request → vault returns secrets → injected into process.env
        ↓
LLM / agent context sees variable names only. Values never transit to the model.
```

---

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Setting up the vault](#setting-up-the-vault)
3. [Dashboard](#dashboard)
4. [Registering a project](#registering-a-project)
5. [Managing secrets — CLI](#managing-secrets--cli)
6. [Integrating in your app — SDK](#integrating-in-your-app--sdk)
7. [Key rotation](#key-rotation)
8. [Production deployment](#production-deployment)
9. [Security model](#security-model)
10. [API reference](#api-reference)
11. [Development commands](#development-commands)
12. [Repository structure](#repository-structure)
13. [LLM agent instructions](#llm-agent-instructions)

---

## Prerequisites

| Tool             | Version | Install                                     |
| ---------------- | ------- | ------------------------------------------- |
| **Bun**          | ≥ 1.1   | `curl -fsSL https://bun.sh/install \| bash` |
| **Vite+** (`vp`) | latest  | `curl -fsSL https://vite.plus \| bash`      |

```bash
bun --version   # 1.1+
vp --version
```

---

## Setting up the vault

### 1. Clone and install

```bash
git clone https://github.com/florianjs/opaque.git
cd opaque
vp install
```

### 2. Configure environment variables

Create `apps/server/.env` — **never commit this file**:

```bash
OPAQUE_MASTER_KEY="<32-byte hex>"    # openssl rand -hex 32
OPAQUE_ADMIN_TOKEN="<random secret>" # openssl rand -hex 32
OPAQUE_PORT=4200
DATABASE_URL="file:./opaque.db"
```

| Variable             | Required | Description                                                   |
| -------------------- | -------- | ------------------------------------------------------------- |
| `OPAQUE_MASTER_KEY`  | **yes**  | 32-byte hex key for AES-256-GCM encryption of secrets at rest |
| `OPAQUE_ADMIN_TOKEN` | **yes**  | Bearer token for dashboard and CLI management operations      |
| `OPAQUE_PORT`        | no       | Port to listen on (default: `4200`)                           |
| `DATABASE_URL`       | no       | LibSQL/SQLite connection string (default: `file:./opaque.db`) |

### 3. Run database migrations

```bash
cd apps/server
DATABASE_URL="file:./opaque.db" pnpm exec drizzle-kit migrate
cd ../..
```

### 4. Build the dashboard

The dashboard is a static Vue 3 SPA served by the vault at `/ui`. Build it once before starting:

```bash
pnpm --filter @opaque/ui build
```

### 5. Start the vault

```bash
vp run server:dev
```

The vault starts at **http://localhost:4200** with hot reload. Visit **http://localhost:4200/ui** for the dashboard.

```bash
curl http://localhost:4200/health
# {"ok":true}
```

---

## Dashboard

The dashboard is served at **http://localhost:4200/ui** by the vault itself.

On first visit, enter your `OPAQUE_ADMIN_TOKEN` — it is stored in `localStorage` and used for all admin API calls.

**Capabilities:**

- Browse and manage projects
- Add / delete secrets per project and environment (write-only — values are never displayed)
- View audit log

### Rebuild after UI changes

```bash
pnpm --filter @opaque/ui build
# then restart the vault
```

### UI dev server (hot reload)

```bash
vp dev   # Vite HMR, proxies /v1 to localhost:4200
```

---

## Registering a project

Each application that needs secrets must be registered on the vault. Registration generates an Ed25519 keypair: the vault stores the public key, you store the private key in your CI/CD.

### Via CLI

```bash
# Install the CLI
npm install -g @opaque/cli

# Point it at your vault
export OPAQUE_VAULT_URL="http://localhost:4200"
export OPAQUE_ADMIN_TOKEN="<your admin token>"

# Register
opaque register --project my-app
# → OPAQUE_PRIVATE_KEY={"kty":"OKP","crv":"Ed25519","d":"...","x":"..."}
#
# Add this value to your CI/CD secrets — it is the only secret your app needs.
```

### Via dashboard

Go to **http://localhost:4200/ui** → Projects → New project. The private key is shown once — copy it to your CI/CD immediately.

---

## Managing secrets — CLI

```bash
export OPAQUE_VAULT_URL="http://localhost:4200"
export OPAQUE_ADMIN_TOKEN="<your admin token>"
```

#### Add or update a secret

```bash
opaque set --project my-app --env production DATABASE_URL=postgres://...
opaque set --project my-app --env production STRIPE_SECRET_KEY=sk_live_...
opaque set --project my-app --env development DATABASE_URL=postgres://localhost/myapp
```

The `--env` value is a free string — use `production`, `development`, branch names, PR numbers, anything.

#### List keys (values masked)

```bash
opaque list --project my-app --env production
# DATABASE_URL        production   2026-03-19
# STRIPE_SECRET_KEY   production   2026-03-19
```

#### Read a single value

```bash
opaque get --project my-app --env production DATABASE_URL
```

#### Dump all secrets as KEY=value (for scripting)

```bash
opaque pull --project my-app --env production
# DATABASE_URL=postgres://...
# STRIPE_SECRET_KEY=sk_live_...
```

#### View access audit log

```bash
opaque audit --project my-app
# 2026-03-19 12:00:01   fetch   production   192.168.1.1
```

---

## Integrating in your app — SDK

Every application needs exactly three environment variables:

```bash
OPAQUE_PRIVATE_KEY="<printed by opaque register>"
OPAQUE_VAULT_URL="https://your-vault.example.com"
OPAQUE_PROJECT="my-app"
```

At boot, the SDK signs a request with the private key, fetches the secrets from the vault, and injects them into `process.env`. Your application code reads from `process.env` as usual — nothing changes except secrets no longer live in your repo or deployment config.

### Node.js

```bash
npm install @opaque/node
```

```ts
// server.ts — must be the very first import
import { bootstrap } from '@opaque/node';
await bootstrap();

// Secrets are now in process.env
import { startServer } from './app';
startServer();
```

### Next.js

```bash
npm install @opaque/next
```

Create `instrumentation.ts` at the project root:

```ts
import { register } from '@opaque/next';
export { register };
```

Enable in `next.config.ts`:

```ts
const nextConfig = {
  experimental: { instrumentationHook: true },
};
export default nextConfig;
```

### Nuxt

```bash
npm install @opaque/nuxt
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@opaque/nuxt'],
  opaque: {
    vaultUrl: process.env.OPAQUE_VAULT_URL,
    privateKey: process.env.OPAQUE_PRIVATE_KEY,
    project: process.env.OPAQUE_PROJECT,
  },
});
```

### Core SDK (any runtime)

```bash
npm install @opaque/core
```

```ts
import { fetchSecrets, injectEnv } from '@opaque/core';

const secrets = await fetchSecrets({
  vaultUrl: process.env.OPAQUE_VAULT_URL!,
  privateKey: process.env.OPAQUE_PRIVATE_KEY!,
  project: process.env.OPAQUE_PROJECT!,
  env: 'production', // optional, defaults to process.env.NODE_ENV
});

injectEnv(secrets, process.env as Record<string, string>);
```

---

## Key rotation

Rotate a project keypair without downtime:

```bash
# 1. Generate new keypair — old key stays valid for 10 minutes
opaque rotate --project my-app
# → New OPAQUE_PRIVATE_KEY={"kty":"OKP",...}

# 2. Update OPAQUE_PRIVATE_KEY in your CI/CD secrets

# 3. Redeploy your application

# After 10 minutes the vault drops the old key automatically.
```

---

## Production deployment

### Environment variables

```bash
OPAQUE_MASTER_KEY="<32-byte hex — store in your secrets manager, never in code>"
OPAQUE_ADMIN_TOKEN="<long random token — store in your secrets manager>"
OPAQUE_PORT=4200
DATABASE_URL="libsql://your-db.turso.io?authToken=<token>"  # Turso for edge
```

### Run migrations

```bash
cd apps/server
DATABASE_URL="$DATABASE_URL" pnpm exec drizzle-kit migrate
```

### Build for production

```bash
pnpm --filter @opaque/ui build    # build dashboard → apps/ui/dist/
vp run server:build               # compile vault → apps/server/dist/
vp run server:start               # run compiled vault
```

### Reverse proxy — HTTPS required

The vault must be behind HTTPS in production. Example Caddyfile:

```
vault.example.com {
  reverse_proxy localhost:4200
}
```

### Docker

```dockerfile
FROM oven/bun:1 AS builder
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun build apps/server/src/index.ts --outdir apps/server/dist --target bun
RUN bun x vite build --config apps/ui/vite.config.ts

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/ui/dist ./apps/ui/dist
COPY --from=builder /app/node_modules ./node_modules

ENV OPAQUE_PORT=4200
EXPOSE 4200
CMD ["bun", "run", "dist/index.js"]
```

### Fly.io

```bash
fly launch --name opaque-vault
fly secrets set OPAQUE_MASTER_KEY="..." OPAQUE_ADMIN_TOKEN="..." DATABASE_URL="..."
fly deploy
```

---

## Security model

| Threat                     | Mitigation                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| Secret value leaked to LLM | Injected server-side only. Dashboard is write-only — values never displayed.                        |
| Private key stolen         | `opaque rotate` — old key invalid after 10-minute overlap window.                                   |
| MITM                       | TLS required in production. Vault must be behind HTTPS.                                             |
| Replay attack              | Nonce + `expires` on every request. Nonces cached for 10 minutes.                                   |
| Secrets at rest            | AES-256-GCM. Master key in env var, never in DB.                                                    |
| Unauthorized access        | Ed25519 signature verification on all `/v1/secrets/*`. Separate `OPAQUE_ADMIN_TOKEN` for admin ops. |
| Brute force                | Rate limiting: 100 req/min per IP.                                                                  |

### Authentication flow

```
1. App reads OPAQUE_PRIVATE_KEY from process.env

2. signRequest()
   ├─ Parse Ed25519 private key JWK
   ├─ Build RFC 9421 canonical message (@method, @authority, @target-uri)
   ├─ Add created / expires (5 min window) / nonce to Signature-Input
   └─ Sign with Ed25519

3. GET /v1/secrets?env=production
   Signature:       sig1=:<base64>:
   Signature-Input: sig1=("@method" "@authority" "@target-uri");created=...;nonce=...
   Signature-Agent: sig1=my-app.agents.opaque.local;pubkey="..."

4. Vault authMiddleware
   ├─ Extract projectId from Signature-Agent
   ├─ Fetch project.publicKey from DB
   ├─ Verify Ed25519 signature
   ├─ Check created/expires window
   ├─ Check nonce not replayed
   └─ Pass → set ctx.projectId

5. Vault decrypts AES-256-GCM → returns { KEY: "value", ... }

6. injectEnv() merges into process.env
```

---

## API reference

### Admin endpoints (Bearer token: `Authorization: Bearer <OPAQUE_ADMIN_TOKEN>`)

| Method   | Path                             | Description                            |
| -------- | -------------------------------- | -------------------------------------- |
| `GET`    | `/v1/admin/projects`             | List all projects                      |
| `POST`   | `/v1/admin/projects`             | Create a project `{ name, publicKey }` |
| `DELETE` | `/v1/admin/projects/:id`         | Delete a project (cascades secrets)    |
| `PUT`    | `/v1/admin/projects/:id/rotate`  | Rotate project keypair                 |
| `GET`    | `/v1/admin/projects/:id/secrets` | List secret keys (no values)           |
| `DELETE` | `/v1/admin/secrets/:id`          | Delete a secret                        |
| `GET`    | `/v1/admin/audit`                | Audit log `?projectId=&limit=`         |

### SDK endpoints (Ed25519 HTTP Message Signature)

| Method   | Path                         | Description                                  |
| -------- | ---------------------------- | -------------------------------------------- |
| `GET`    | `/v1/secrets?env=production` | Fetch and decrypt all secrets                |
| `PUT`    | `/v1/secrets`                | Create/update a secret `{ key, value, env }` |
| `DELETE` | `/v1/secrets/:id`            | Delete a secret                              |

### Health

| Method | Path      | Description            |
| ------ | --------- | ---------------------- |
| `GET`  | `/health` | Returns `{ ok: true }` |

---

## Development commands

```bash
vp install          # install all workspace dependencies
vp run server:dev   # start vault server (Bun hot reload, port 4200)
vp dev              # start dashboard dev server (Vite HMR)
vp check            # format + lint + typecheck (Oxfmt + Oxlint)
vp check --fix      # auto-fix formatting and lint issues
vp test             # run all tests (Vitest)
vp pack             # build SDK packages for npm (Rolldown + tsdown)
vp build            # production build (all packages + apps)
vp run db:migrate   # run Drizzle migrations
vp run db:studio    # open Drizzle Studio (DB browser)
```

Single test file:

```bash
vp test packages/core/src/crypto.test.ts
```

---

## Repository structure

```
opaque/
├── packages/
│   ├── core/     @opaque/core   — zero-dep TypeScript SDK (fetch, inject, watch, rotate, crypto)
│   ├── nuxt/     @opaque/nuxt   — Nuxt module (hooks into nitro:init)
│   ├── next/     @opaque/next   — Next.js instrumentation.ts adapter
│   ├── node/     @opaque/node   — bare Node bootstrap()
│   └── cli/      @opaque/cli    — management CLI (citty)
└── apps/
    ├── server/   Hono + Bun vault — routes, middleware, db, crypto (port 4200)
    └── ui/       Vue 3 dashboard — served as static at /ui
```

---

## LLM agent instructions

> **📋 Add this section to your system prompt or AGENTS.md**
>
> This project uses **opaque** to manage secrets. Secret values are never stored in `.env` files, never committed to the repository, and never passively present in your context — they are fetched at runtime by the application itself via a signed Ed25519 request.
>
> **What opaque protects against:** accidental leakage through code, git history, logs, or passive context. Secret values will not appear in your context unless you deliberately retrieve them with a tool call.
>
> **What opaque does not prevent:** an agent with shell access and `OPAQUE_PRIVATE_KEY` in its environment can still retrieve secret values via `opaque pull` or by signing a direct API call. All access is traced — every fetch is logged with a timestamp and IP in the audit table.
>
> **As an AI agent, follow these rules:**
>
> - To check which secrets exist: `opaque list --project <name> --env <env>` — returns key names only, never values.
> - To add or update a secret: `opaque set --project <name> --env <env> KEY=value`.
> - To retrieve secrets into a shell for local scripting: `opaque pull --project <name> --env <env>` — only do this when explicitly instructed by the user.
> - To rotate a compromised key: `opaque rotate --project <name>`, then update `OPAQUE_PRIVATE_KEY` in the deployment environment.
> - Never hardcode secret values in source files, config files, or commit messages.
> - Never print, log, or include secret values in your responses or tool call outputs.
> - Never read or expose `OPAQUE_MASTER_KEY` or `OPAQUE_ADMIN_TOKEN`.

---

## License

MIT
