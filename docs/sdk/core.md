# Core SDK

`@opaque/core` is the zero-dependency foundation of the opaque SDK. It works in any JavaScript runtime that supports `fetch` and the WebCrypto API: Node.js >= 18, Bun, Deno, browsers, Cloudflare Workers (with caveats).

All framework adapters (`@opaque/node`, `@opaque/next`, `@opaque/nuxt`) are thin wrappers around `@opaque/core`.

## Installation

```bash
npm install @opaque/core
# or
bun add @opaque/core
```

## API

### `fetchSecrets(config)`

Fetches all secrets for a project and environment from the vault.

```ts
import { fetchSecrets } from '@opaque/core'

const secrets = await fetchSecrets({
  vaultUrl: 'https://vault.example.com',
  privateKey: process.env.OPAQUE_PRIVATE_KEY!,
  project: 'my-app',
  env: 'production', // optional — defaults to process.env.NODE_ENV ?? 'production'
})

// secrets = { DATABASE_URL: '...', STRIPE_KEY: '...', ... }
console.log(secrets.DATABASE_URL)
```

**Parameters:**

```ts
interface OpaqueConfig {
  vaultUrl: string    // Base URL of the vault
  privateKey: string  // Ed25519 private key in JWK JSON format
  project: string     // Project name as registered on the vault
  env?: string        // Environment name — defaults to process.env.NODE_ENV
}
```

**Returns:** `Promise<Record<string, string>>`

**Throws:** `Error` with message prefixed `opaque:` on auth failure, network error, or non-2xx response.

---

### `injectEnv(secrets, target, options?)`

Merges a secrets record into a target object (typically `process.env`).

```ts
import { fetchSecrets, injectEnv } from '@opaque/core'

const secrets = await fetchSecrets({ /* ... */ })
injectEnv(secrets, process.env as Record<string, string>)

// Now process.env.DATABASE_URL, etc. are set
```

**Parameters:**

```ts
function injectEnv(
  secrets: Record<string, string>,
  target: Record<string, string | undefined>,
  options?: { force?: boolean }
): void
```

| Option | Default | Description |
|---|---|---|
| `force` | `false` | If `true`, overwrites existing values in `target`. If `false`, skips keys already set. |

By default, values already in `process.env` take precedence. This means if `DATABASE_URL` is already set (e.g., from a local `.env` file during development), the vault value does not overwrite it. Set `force: true` to always use vault values.

---

### `watchSecrets(options)`

Polls the vault on an interval and calls `onUpdate` with the latest secrets. Returns a stop function.

```ts
import { watchSecrets } from '@opaque/core'

const stop = watchSecrets({
  vaultUrl: process.env.OPAQUE_VAULT_URL!,
  privateKey: process.env.OPAQUE_PRIVATE_KEY!,
  project: process.env.OPAQUE_PROJECT!,
  interval: 60_000, // ms — default 60 seconds
  onUpdate(secrets) {
    Object.assign(process.env, secrets)
    console.log('opaque: secrets refreshed')
  },
  onError(err) {
    console.error('opaque: refresh failed —', err.message)
  },
})

// Stop watching when shutting down
process.on('SIGTERM', stop)
```

**Parameters:**

```ts
interface WatchOptions extends OpaqueConfig {
  interval?: number             // Poll interval in ms (default: 60_000)
  onUpdate: (secrets: Record<string, string>) => void
  onError?: (err: Error) => void
}
```

`onUpdate` is called immediately on start, then every `interval` milliseconds.

If `onError` is not provided and a fetch fails, the error is silently swallowed and the previous secrets remain in place. Provide `onError` to log or alert on failures.

---

### `rotateKey(config)`

Programmatically rotate a project's keypair. Used internally by the CLI.

```ts
import { rotateKey } from '@opaque/core'

const { privateKey } = await rotateKey({
  vaultUrl: 'https://vault.example.com',
  adminToken: process.env.OPAQUE_ADMIN_TOKEN!,
  project: 'my-app',
})

console.log('New OPAQUE_PRIVATE_KEY:', privateKey)
```

**Returns:** `Promise<{ privateKey: string }>` — the new private key JWK as a JSON string.

---

## Types

```ts
export interface OpaqueConfig {
  vaultUrl: string
  privateKey: string
  project: string
  env?: string
}

export type SecretsRecord = Record<string, string>
```

## Direct usage example — custom runtime

If you are using a framework not covered by the adapters, wire it up with `@opaque/core` directly:

```ts
// For any server framework with an initialization hook
import { fetchSecrets, injectEnv } from '@opaque/core'

export async function initSecrets() {
  const secrets = await fetchSecrets({
    vaultUrl: process.env.OPAQUE_VAULT_URL!,
    privateKey: process.env.OPAQUE_PRIVATE_KEY!,
    project: process.env.OPAQUE_PROJECT!,
  })
  injectEnv(secrets, process.env as Record<string, string>)
}
```

```ts
// Hono on Bun
import { Hono } from 'hono'
import { initSecrets } from './secrets'

await initSecrets()  // fetch before defining routes

const app = new Hono()
app.get('/', (c) => c.json({ db: process.env.DATABASE_URL }))
export default app
```

## Zero dependencies

`@opaque/core` has no runtime dependencies. It uses:

- The `fetch` global for HTTP requests
- `crypto.subtle` (WebCrypto) for signature verification
- `@noble/ed25519` (bundled/peer — check your adapter) for Ed25519 signing

It does not import Hono, Next, Nuxt, Node.js built-ins, or any other framework. This makes it safe to use in any environment.
