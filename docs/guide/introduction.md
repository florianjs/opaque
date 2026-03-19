# Introduction

**opaque** is a self-hosted secrets vault built for the age of AI-agent workflows. It keeps secret values — database connection strings, API keys, tokens — on a server you control, completely out of reach of any language model or AI agent that runs your code.

## The problem

When an LLM or AI agent has access to your codebase, it also has access to everything in that codebase: environment files, deployment configs, CI/CD variables that get echoed into logs, `.env.example` files that contain real values, and so on. Even when secrets aren't hardcoded, they often end up in context through indirect paths: a README that shows example values, a config file that references a connection string, a startup log that prints environment variables.

The traditional answer — "just don't put secrets in code" — breaks down when the entity reading the code is an AI agent with shell access and the ability to read any file it can reach.

## The mental model

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

The vault is the only place where secret values exist in plaintext (transiently, in memory, during decryption). Everything else — your repository, your CI/CD pipeline, your deployment manifests, your LLM's context window — contains only key names at most.

## What opaque protects

| Protected against | How |
|---|---|
| Secrets in code / git history | Values are never written to files — only the private key goes in CI/CD |
| Secrets in LLM context | The SDK injects secrets into `process.env` at boot, after the agent's context is established |
| Secrets in deployment configs | Three non-secret vars replace all `.env` content in your deployment config |
| Passive exposure through logs | Dashboard is write-only; values are never logged, never displayed |
| Replay attacks | Every request carries a nonce and a 5-minute expiry window |
| Brute force | 100 req/min per IP rate limiting |

## What opaque does not prevent

opaque is not a sandbox. An AI agent that has:

- Shell access **and**
- `OPAQUE_PRIVATE_KEY` in its environment

...can run `opaque pull` and retrieve all secret values for that project. This is intentional: the agent is acting as the authenticated application. All such accesses are recorded in the audit log with a timestamp and IP address.

The goal is **not** to make secrets physically unretrievable by authorized processes — the goal is to eliminate passive, accidental exposure and to maintain a full audit trail of every access.

::: warning Agent access policy
If you give an AI agent shell access and `OPAQUE_PRIVATE_KEY`, treat that as granting the agent access to the corresponding secrets. Use separate projects with minimal secret sets for agent environments, and review the audit log regularly.
:::

## Architecture overview

```
opaque/
├── packages/
│   ├── core/     @opaque/core   — zero-dep TypeScript SDK
│   ├── nuxt/     @opaque/nuxt   — Nuxt module (nitro:init hook)
│   ├── next/     @opaque/next   — Next.js instrumentation.ts adapter
│   ├── node/     @opaque/node   — bare Node bootstrap()
│   └── cli/      @opaque/cli    — management CLI (citty)
└── apps/
    ├── server/   Hono + Bun vault — routes, middleware, db, crypto (port 4200)
    └── ui/       Vue 3 dashboard — served as static at /ui
```

The vault runs on **Bun** with **Hono** as the HTTP framework. The database is **LibSQL/SQLite** managed by **Drizzle ORM**. Signing uses **@noble/ed25519** (audited, zero-dependency). Encryption at rest uses the native **WebCrypto AES-256-GCM**.

## Security tradeoffs

opaque makes one explicit tradeoff: it centralizes your secrets. A compromised vault server means all secrets are potentially at risk. This is why:

- The vault **must** run behind HTTPS in production
- `OPAQUE_MASTER_KEY` must be stored in a separate secrets manager, not in the vault itself
- `OPAQUE_ADMIN_TOKEN` must be a long random value, rotated periodically
- Database backups must be treated with the same care as secret values

For most teams, this tradeoff is correct: one well-secured server is easier to audit than secrets scattered across dozens of `.env` files, CI/CD secret stores, and developer machines.
