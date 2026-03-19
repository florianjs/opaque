# Node.js SDK

`@florianjs/opaque-node` is the simplest adapter: a single `bootstrap()` function that fetches secrets and injects them into `process.env` before your app starts.

Works with Node.js >= 18 and Bun >= 1.1.

## Installation

```bash
npm install @florianjs/opaque-node
# or
bun add @florianjs/opaque-node
```

## Setup

Add the three opaque environment variables to your deployment config:

```bash
OPAQUE_PRIVATE_KEY='{"kty":"OKP","crv":"Ed25519","d":"...","x":"..."}'
OPAQUE_VAULT_URL="https://vault.example.com"
OPAQUE_PROJECT="my-app"
```

## Usage

Call `bootstrap()` as the very first thing in your entry point, before any other imports that might read from `process.env`:

```ts
// server.ts
import { bootstrap } from "@florianjs/opaque-node";
await bootstrap();

// All secrets are now in process.env — safe to import the rest of your app
import { createServer } from "./app";
const server = createServer();
server.listen(3000);
```

::: warning Bootstrap must be first
`bootstrap()` must be awaited before any code that reads from `process.env`. In TypeScript/ESM, top-level `await` works in the entry module. In CommonJS, wrap in an async IIFE:

```ts
// CommonJS entry point
const { bootstrap } = require("@florianjs/opaque-node");

async function main() {
  await bootstrap();
  const { app } = require("./app"); // require after bootstrap
  app.listen(3000);
}

main().catch(console.error);
```

:::

## Express example

```ts
// index.ts
import { bootstrap } from "@florianjs/opaque-node";
await bootstrap();

// Express reads process.env.PORT, process.env.DATABASE_URL, etc.
import express from "express";
import { Pool } from "pg";

const app = express();
const db = new Pool({ connectionString: process.env.DATABASE_URL });

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(Number(process.env.PORT ?? 3000));
```

## Fastify example

```ts
// server.ts
import { bootstrap } from "@florianjs/opaque-node";
await bootstrap();

import Fastify from "fastify";

const server = Fastify({ logger: true });

server.get("/", async () => {
  return { message: "hello" };
});

await server.listen({ port: Number(process.env.PORT ?? 3000) });
```

## Explicit configuration

If you prefer not to rely on environment variables, pass config directly:

```ts
import { fetchSecrets, injectEnv } from "@florianjs/opaque";

const secrets = await fetchSecrets({
  vaultUrl: "https://vault.example.com",
  privateKey: process.env.OPAQUE_PRIVATE_KEY!,
  project: "my-app",
  env: "production", // override NODE_ENV
});

injectEnv(secrets, process.env as Record<string, string>);
```

## Force override existing values

By default, `injectEnv` does not overwrite values already set in `process.env`. This means existing environment variables take precedence over vault values. To force vault values:

```ts
import { fetchSecrets, injectEnv } from "@florianjs/opaque";

const secrets = await fetchSecrets({
  /* ... */
});
injectEnv(secrets, process.env as Record<string, string>, { force: true });
```

## Bun

`@florianjs/opaque-node` works identically in Bun. No additional configuration is needed:

```ts
// index.ts (Bun)
import { bootstrap } from "@florianjs/opaque-node";
await bootstrap();

// your app
```

```bash
bun run index.ts
```
