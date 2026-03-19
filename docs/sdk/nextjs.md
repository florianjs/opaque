# Next.js SDK

`@opaque/next` integrates with Next.js via the [instrumentation hook](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation) — a built-in Next.js feature that runs once when the server starts, before any requests are handled.

## Requirements

- Next.js >= 14.0
- Node.js runtime (not Edge runtime — Ed25519 signing requires Node.js crypto)

## Installation

```bash
npm install @opaque/next
```

## Configuration

### 1. Enable the instrumentation hook

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    instrumentationHook: true,
  },
}

export default nextConfig
```

::: tip Next.js 15+
In Next.js 15, `instrumentationHook` is stable and enabled by default. You can omit the `experimental` flag.
:::

### 2. Create instrumentation.ts

Create `instrumentation.ts` at the **project root** (same level as `app/` or `pages/`):

```ts
// instrumentation.ts
import { register } from '@opaque/next'
export { register }
```

That is all. `@opaque/next` exports a `register` function that Next.js calls automatically when the server starts.

### 3. Set environment variables

Add to your deployment environment (Vercel, Railway, etc.):

```bash
OPAQUE_PRIVATE_KEY='{"kty":"OKP","crv":"Ed25519","d":"...","x":"..."}'
OPAQUE_VAULT_URL="https://vault.example.com"
OPAQUE_PROJECT="my-app"
```

For local development, add to `.env.local` (this file is gitignored by Next.js by default):

```bash
# .env.local — not committed
OPAQUE_PRIVATE_KEY='{"kty":"OKP","crv":"Ed25519","d":"...","x":"..."}'
OPAQUE_VAULT_URL="http://localhost:4200"
OPAQUE_PROJECT="my-app"
```

## How it works

The `register` function exported by `@opaque/next`:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const secrets = await fetchSecrets({
      vaultUrl: process.env.OPAQUE_VAULT_URL ?? '',
      privateKey: process.env.OPAQUE_PRIVATE_KEY ?? '',
      project: process.env.OPAQUE_PROJECT ?? '',
    })
    injectEnv(secrets, process.env as Record<string, string>)
  }
}
```

The `NEXT_RUNTIME === 'nodejs'` guard ensures the fetch only runs in the Node.js runtime, not in the Edge runtime (which lacks the WebCrypto APIs needed for Ed25519 signing). If your app uses Edge middleware, those routes will not have opaque secrets — keep Edge routes stateless.

## Using secrets in route handlers

After `register()` runs, all vault secrets are in `process.env`:

```ts
// app/api/data/route.ts
import { Pool } from 'pg'

// process.env.DATABASE_URL was injected by @opaque/next at startup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function GET() {
  const result = await pool.query('SELECT now()')
  return Response.json(result.rows[0])
}
```

```ts
// lib/stripe.ts
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20',
})
```

## Vercel deployment

On Vercel, add the three env vars in your project settings under **Settings → Environment Variables**. Vercel runs `instrumentation.ts` on each serverless function cold start.

```bash
# Using Vercel CLI
vercel env add OPAQUE_PRIVATE_KEY
vercel env add OPAQUE_VAULT_URL
vercel env add OPAQUE_PROJECT
```

::: tip Multiple environments on Vercel
Use Vercel's environment scoping (Production / Preview / Development) combined with opaque's `env` parameter to manage per-environment secrets:

- Production builds → `NODE_ENV=production` → opaque fetches `env=production` secrets
- Preview deployments → `NODE_ENV=preview` → opaque fetches `env=preview` secrets
:::

## Troubleshooting

**Secrets not available in route handlers:**
- Verify `instrumentation.ts` is at the project root (not inside `app/` or `src/`)
- Verify `instrumentationHook: true` is in `next.config.ts` (Next.js < 15)
- Check the server startup logs for `opaque:` prefixed errors

**Build-time errors:**
- opaque runs at **runtime**, not build time. `process.env.DATABASE_URL` will be undefined during `next build` — this is expected. Don't access opaque-managed secrets in `getStaticProps` or module-level code that runs at build time.

**Edge runtime:**
- The `register` function skips when `NEXT_RUNTIME !== 'nodejs'`. Secrets are not available in Edge middleware or Edge API routes.
