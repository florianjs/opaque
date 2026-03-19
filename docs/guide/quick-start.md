# Quick Start

Get a working opaque vault running locally in under 5 minutes.

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| **Bun** | >= 1.1 | `curl -fsSL https://bun.sh/install \| bash` |
| **Vite+** (`vp`) | latest | `curl -fsSL https://vite.plus \| bash` |

Verify:

```bash
bun --version   # 1.1+
vp --version
```

## Step 1 — Clone and install

```bash
git clone https://github.com/your-org/opaque.git
cd opaque
vp install
```

`vp install` installs all workspace dependencies across the monorepo.

## Step 2 — Generate secrets and configure the vault

Create `apps/server/.env`:

```bash
# Generate values — run these in your terminal
openssl rand -hex 32   # use output as OPAQUE_MASTER_KEY
openssl rand -hex 32   # use output as OPAQUE_ADMIN_TOKEN
```

```bash
# apps/server/.env — never commit this file
OPAQUE_MASTER_KEY="a1b2c3d4..."   # 32-byte hex from openssl above
OPAQUE_ADMIN_TOKEN="e5f6a7b8..."  # long random token from openssl above
OPAQUE_PORT=4200
DATABASE_URL="file:./opaque.db"
```

::: danger Never commit .env
The `apps/server/.env` file contains your master encryption key. Add it to `.gitignore` if it isn't already. If you accidentally commit it, rotate `OPAQUE_MASTER_KEY` immediately — all existing secrets will need to be re-encrypted.
:::

## Step 3 — Run database migrations

```bash
vp run db:migrate
```

This creates the SQLite database and applies the Drizzle schema migrations.

## Step 4 — Build the dashboard

The dashboard is a static Vue 3 SPA that the vault serves at `/ui`. Build it once:

```bash
vp build
```

## Step 5 — Start the vault

```bash
vp run server:dev
```

You should see the ASCII banner and URLs:

```
   ██████╗ ██████╗  █████╗  ██████╗ ██╗   ██╗███████╗
  ...

  ▶  Vault   http://localhost:4200
  ▶  UI      http://localhost:4200/ui
     Ed25519 · AES-256-GCM · RFC 9421 · Vite+
```

Verify the vault is up:

```bash
curl http://localhost:4200/health
# {"ok":true}
```

Visit **http://localhost:4200/ui** in your browser. On first visit, enter your `OPAQUE_ADMIN_TOKEN` — it is stored in `localStorage` and used for all dashboard operations.

## Step 6 — Install the CLI and register your first project

```bash
npm install -g @opaque/cli

export OPAQUE_VAULT_URL="http://localhost:4200"
export OPAQUE_ADMIN_TOKEN="<your admin token from Step 2>"

opaque register --project my-app
```

The CLI prints a new `OPAQUE_PRIVATE_KEY`. **Copy it immediately** — it is shown only once. This is the private key your application will use to authenticate with the vault.

```
OPAQUE_PRIVATE_KEY={"kty":"OKP","crv":"Ed25519","d":"...","x":"..."}
```

## Step 7 — Add your first secret

```bash
opaque set --project my-app --env production DATABASE_URL="postgres://localhost/myapp"
opaque set --project my-app --env production STRIPE_KEY="sk_test_..."

# Verify — values are masked
opaque list --project my-app --env production
# DATABASE_URL    production   2026-03-19
# STRIPE_KEY      production   2026-03-19
```

## Step 8 — Integrate in your application

Pick the adapter for your framework:

:::code-group

```bash [Node.js]
npm install @opaque/node
```

```bash [Next.js]
npm install @opaque/next
```

```bash [Nuxt]
npm install @opaque/nuxt
```

:::

Add three environment variables to your application (these are the **only** env vars it needs):

```bash
OPAQUE_PRIVATE_KEY='{"kty":"OKP","crv":"Ed25519","d":"...","x":"..."}'
OPAQUE_VAULT_URL="http://localhost:4200"
OPAQUE_PROJECT="my-app"
```

Add the bootstrap call:

:::code-group

```ts [Node.js — server.ts]
// Must be the very first import
import { bootstrap } from '@opaque/node'
await bootstrap()

// All secrets are now in process.env
import { startServer } from './app'
startServer()
```

```ts [Next.js — instrumentation.ts]
import { register } from '@opaque/next'
export { register }
```

```ts [Nuxt — nuxt.config.ts]
export default defineNuxtConfig({
  modules: ['@opaque/nuxt'],
  opaque: {
    vaultUrl: process.env.OPAQUE_VAULT_URL,
    privateKey: process.env.OPAQUE_PRIVATE_KEY,
    project: process.env.OPAQUE_PROJECT,
  },
})
```

:::

Your application now reads `process.env.DATABASE_URL` as usual — but the value came from the vault, not from a `.env` file.

## Next steps

- [Vault Setup](/guide/vault-setup) — production configuration, Docker, Fly.io, Caddy
- [Key Rotation](/guide/key-rotation) — zero-downtime keypair rotation
- [CLI Commands](/cli/commands) — full CLI reference
- [Security Model](/security/model) — threat model and authentication flow
