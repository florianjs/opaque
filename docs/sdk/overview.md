# SDK Overview

opaque provides a layered SDK: a zero-dependency core package, and thin adapters for popular frameworks that call the core under the hood.

## Packages

| Package                  | Use case                                                                       |
| ------------------------ | ------------------------------------------------------------------------------ |
| `@florianjs/opaque-node` | Bare Node.js and Bun apps — `await bootstrap()` at the top of your entry point |
| `@florianjs/opaque-next` | Next.js — hooks into `instrumentation.ts`                                      |
| `@florianjs/opaque-nuxt` | Nuxt — module that hooks into `nitro:init`                                     |
| `@florianjs/opaque`      | Any runtime — direct access to `fetchSecrets`, `injectEnv`, `watchSecrets`     |

All adapters wrap `@florianjs/opaque`. If your framework is not listed, use `@florianjs/opaque` directly.

## Three environment variables

Every adapter reads from the same three environment variables:

```bash
OPAQUE_PRIVATE_KEY="<Ed25519 private key JWK>"
OPAQUE_VAULT_URL="https://vault.example.com"
OPAQUE_PROJECT="my-app"
```

These are the **only** deployment-environment credentials your application needs. All other secrets live in the vault.

| Variable             | Description                                                     |
| -------------------- | --------------------------------------------------------------- |
| `OPAQUE_PRIVATE_KEY` | Ed25519 private key in JWK format, printed by `opaque register` |
| `OPAQUE_VAULT_URL`   | Base URL of your opaque vault, including scheme and port        |
| `OPAQUE_PROJECT`     | Project name as registered on the vault                         |

## What happens at boot

1. The adapter reads `OPAQUE_PRIVATE_KEY`, `OPAQUE_VAULT_URL`, and `OPAQUE_PROJECT` from `process.env`
2. `signRequest()` builds an RFC 9421 HTTP Message Signature using Ed25519
3. `fetchSecrets()` makes a `GET /v1/secrets?env=<NODE_ENV>` request with the signed headers
4. The vault verifies the signature, decrypts the AES-256-GCM values, and returns `{ KEY: "value", ... }`
5. `injectEnv()` merges the secrets into `process.env`
6. Your application code reads from `process.env` as usual

The entire fetch + inject cycle happens **before** your application code runs (before any route handlers, before any database connections are opened). By the time your code accesses `process.env.DATABASE_URL`, the value is already there.

## Environment namespacing

The env parameter corresponds to the `--env` flag used with `opaque set`. It defaults to `process.env.NODE_ENV`:

```bash
# Vault looks up secrets where env = "production"
NODE_ENV=production  # or pass env explicitly to fetchSecrets()
```

You can use any string as an environment name — branch names, PR numbers, arbitrary labels:

```bash
opaque set --project my-app --env pr-456 DATABASE_URL="postgres://staging/pr456"
# → fetchSecrets({ env: 'pr-456' }) fetches that value
```

## Watching for updates

For long-running processes that need to pick up secret changes without restarting, use `watchSecrets` from `@florianjs/opaque`:

```ts
import { watchSecrets } from "@florianjs/opaque";

const stop = watchSecrets({
  vaultUrl: process.env.OPAQUE_VAULT_URL!,
  privateKey: process.env.OPAQUE_PRIVATE_KEY!,
  project: process.env.OPAQUE_PROJECT!,
  interval: 60_000, // poll every 60 seconds (default)
  onUpdate(secrets) {
    // Called immediately on start, then every `interval` ms
    // Re-inject or process updated values
    Object.assign(process.env, secrets);
  },
  onError(err) {
    console.error("opaque: failed to refresh secrets", err.message);
  },
});

// Later, to stop watching:
stop();
```

::: tip When to use watchSecrets
Most applications only need to fetch secrets once at boot. Use `watchSecrets` when:

- Your process runs for hours or days and secrets may be rotated
- You have a worker that needs to pick up updated API keys without a restart
- You are building a proxy or gateway that needs fresh credentials
  :::

## Behavior when vault is unreachable

If the vault is unreachable at boot, `fetchSecrets` throws an error prefixed with `opaque:`. The error propagates up to the adapter, which lets it crash the process — this is intentional. A process that starts without its secrets is likely to fail in confusing ways later. Fail fast and visible.

```
Error: opaque: failed to fetch secrets (503) — Service Unavailable
```

If you want graceful degradation, catch the error from `bootstrap()`:

```ts
import { bootstrap } from "@florianjs/opaque-node";

try {
  await bootstrap();
} catch (err) {
  console.error("Failed to load secrets from vault:", err.message);
  // Fall back to process.env values already set in the environment
  // Only do this if you have a genuine fallback strategy
}
```
