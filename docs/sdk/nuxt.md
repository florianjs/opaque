# Nuxt SDK

`@florianjs/opaque-nuxt` is a Nuxt module that hooks into Nitro's initialization lifecycle to fetch and inject secrets before any server routes handle requests.

## Requirements

- Nuxt >= 3.0
- SSR mode (secrets are server-side only — not available in client-side rendering)

## Installation

```bash
npm install @florianjs/opaque-nuxt
```

## Configuration

### 1. Register the module

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@florianjs/opaque-nuxt"],
  opaque: {
    vaultUrl: process.env.OPAQUE_VAULT_URL,
    privateKey: process.env.OPAQUE_PRIVATE_KEY,
    project: process.env.OPAQUE_PROJECT,
  },
});
```

### 2. Set environment variables

For local development, add to `.env` at the project root:

```bash
# .env — not committed
OPAQUE_PRIVATE_KEY='{"kty":"OKP","crv":"Ed25519","d":"...","x":"..."}'
OPAQUE_VAULT_URL="http://localhost:4200"
OPAQUE_PROJECT="my-app"
```

For production, set these in your deployment environment.

## How it works

The module hooks into `nitro:init`, which runs once when the Nitro server starts:

```ts
nuxt.hook("nitro:init", async () => {
  const secrets = await fetchSecrets({
    ...options,
    env: process.env.NODE_ENV,
  });
  injectEnv(secrets, process.env as Record<string, string>);
});
```

After this hook, all vault secrets are available in `process.env` for all Nitro server routes and API handlers.

## Using secrets in API routes

```ts
// server/api/data.get.ts
export default defineEventHandler(async (event) => {
  // process.env.DATABASE_URL was injected by @florianjs/opaque-nuxt at startup
  const db = await connect(process.env.DATABASE_URL!);

  return db.query("SELECT now()");
});
```

```ts
// server/utils/stripe.ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20",
});
```

## Module options

All options are optional — the module falls back to environment variables if not set in `nuxt.config.ts`:

| Option       | Type     | Default                          | Description                  |
| ------------ | -------- | -------------------------------- | ---------------------------- |
| `vaultUrl`   | `string` | `process.env.OPAQUE_VAULT_URL`   | Vault base URL               |
| `privateKey` | `string` | `process.env.OPAQUE_PRIVATE_KEY` | Ed25519 private key JWK      |
| `project`    | `string` | `process.env.OPAQUE_PROJECT`     | Project name                 |
| `env`        | `string` | `process.env.NODE_ENV`           | Secrets environment to fetch |

```ts
// nuxt.config.ts — explicit configuration
export default defineNuxtConfig({
  modules: ["@florianjs/opaque-nuxt"],
  opaque: {
    vaultUrl: "https://vault.example.com",
    privateKey: process.env.OPAQUE_PRIVATE_KEY,
    project: "my-app",
    env: "production", // override NODE_ENV
  },
});
```

## Client-side note

opaque secrets are **server-side only**. They are injected into `process.env` on the server, not into the browser bundle. Do not use `useRuntimeConfig` to expose opaque-managed secrets to the client — this would defeat the purpose of keeping them out of LLM context and browser requests.

If you need a value on the client (e.g., a public API key), manage it as a normal Nuxt runtime config key, not via opaque.

## Deployment

### Nuxt deploy targets

- **Node.js server** (`preset: 'node-server'`): Works out of the box. The `nitro:init` hook runs once at startup.
- **Vercel** (`preset: 'vercel'`): Works on serverless. Hook runs on each cold start.
- **Cloudflare Pages** (`preset: 'cloudflare-pages'`): Not supported — the Cloudflare Workers runtime does not have WebCrypto-based Ed25519 support compatible with `@noble/ed25519`.

::: tip Vercel / serverless cold starts
On serverless platforms, `nitro:init` runs on every cold start. The vault fetch adds a small latency to cold starts (typically 50–200ms). For latency-sensitive applications, consider running the vault on the same network or region as your deployment.
:::

## Troubleshooting

**Secrets not injected:**

- Verify the module is listed in `modules` in `nuxt.config.ts`
- Check the server console for `opaque:` prefixed errors at startup
- Verify the three environment variables are set

**`opaque: failed to fetch secrets` at startup:**

- Check that `OPAQUE_VAULT_URL` is reachable from the deployment environment
- Verify `OPAQUE_PROJECT` matches a registered project on the vault
- Verify `OPAQUE_PRIVATE_KEY` has not been rotated (use `opaque audit` to check)
