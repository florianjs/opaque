---
layout: home

hero:
  name: opaque
  text: Secrets vault for AI agents
  tagline: Secrets live on the server — never in .env files, never in LLM context. One Ed25519 keypair. Zero leaks.
  actions:
    - theme: brand
      text: Quick Start
      link: /guide/quick-start
    - theme: alt
      text: Introduction
      link: /guide/introduction
    - theme: alt
      text: GitHub
      link: https://github.com/your-org/opaque

features:
  - title: Zero .env leaks
    details: Secret values never touch your repository, your deployment config, or your LLM's context window. The only thing that persists outside the vault is a single Ed25519 private key per project.
  - title: Ed25519 authentication
    details: Every request is signed with RFC 9421 HTTP Message Signatures. No bearer tokens in your app code — just a keypair. Rotate it without downtime using a 10-minute overlap window.
  - title: AES-256-GCM at rest
    details: All secret values are encrypted in the database with AES-256-GCM. The master key lives in an environment variable, never in the database. LibSQL/SQLite locally, Turso for production edge.
  - title: Write-only dashboard
    details: The built-in Vue 3 dashboard lets you manage projects and secrets without ever displaying values. No reveal button. No copy-to-clipboard. Write-only by design.
  - title: Full audit log
    details: Every secret fetch is logged with a timestamp, IP address, project ID, and environment. Know exactly when and where your secrets were accessed.
  - title: Framework adapters
    details: Drop-in adapters for Node.js, Next.js, and Nuxt. Or use the zero-dependency core SDK directly in any runtime with fetch and WebCrypto.
---

## Install in 60 seconds

```bash
# Install the CLI
npm install -g @florianjs/opaque-cli

# Point it at your vault
export OPAQUE_VAULT_URL="https://vault.example.com"
export OPAQUE_ADMIN_TOKEN="<your admin token>"

# Register your app — prints OPAQUE_PRIVATE_KEY
opaque register --project my-app

# Add a secret
opaque set --project my-app --env production DATABASE_URL=postgres://...
```

Then add three env vars to your app:

```bash
OPAQUE_PRIVATE_KEY="<printed by opaque register>"
OPAQUE_VAULT_URL="https://vault.example.com"
OPAQUE_PROJECT="my-app"
```

That is all your app needs. At boot, the SDK signs a request, fetches all secrets, and injects them into `process.env`. Your application code reads from `process.env` as usual.

::: tip Self-hosted by design
opaque is not a SaaS product. You run the vault on your own infrastructure — a VPS, a Docker container, Fly.io, or anywhere Bun runs. Your secrets never leave your control.
:::
