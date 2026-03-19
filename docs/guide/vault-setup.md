# Vault Setup

This page covers full vault configuration for development and production environments.

## Environment variables

Create `apps/server/.env` (development) or configure these in your deployment environment (production):

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPAQUE_MASTER_KEY` | **yes** | — | 32-byte hex key for AES-256-GCM encryption of secrets at rest |
| `OPAQUE_ADMIN_TOKEN` | **yes** | — | Bearer token for dashboard and CLI management operations |
| `OPAQUE_PORT` | no | `4200` | Port to listen on |
| `DATABASE_URL` | no | `file:./opaque.db` | LibSQL/SQLite connection string |

Generate secure values:

```bash
openssl rand -hex 32   # OPAQUE_MASTER_KEY
openssl rand -hex 32   # OPAQUE_ADMIN_TOKEN
```

::: danger Master key security
`OPAQUE_MASTER_KEY` is the root of all encryption. If it is lost, all stored secrets are unrecoverable. If it is leaked, all stored secrets are compromised. Store it in a dedicated secrets manager (AWS Secrets Manager, Doppler, 1Password Secrets Automation) — never in the vault's own database or in version control.
:::

## Database

### Local development (SQLite)

```bash
DATABASE_URL="file:./opaque.db"
```

The SQLite file is created automatically when you run migrations.

### Production (Turso / LibSQL)

[Turso](https://turso.tech) provides a managed LibSQL service with global edge replicas:

```bash
# Create a database
turso db create opaque-vault

# Get the connection details
turso db show opaque-vault
# URL: libsql://opaque-vault-yourname.turso.io

# Create an auth token
turso db tokens create opaque-vault
```

```bash
DATABASE_URL="libsql://opaque-vault-yourname.turso.io?authToken=<token>"
```

### Running migrations

```bash
# Development
vp run db:migrate

# Production (from the server directory)
cd apps/server
DATABASE_URL="$DATABASE_URL" bun x drizzle-kit migrate
```

::: tip Drizzle Studio
To browse the database in a web UI during development:
```bash
vp run db:studio
```
:::

## Database schema

The vault uses four tables:

```
projects  — registered applications (id, name, publicKey, rotatingPublicKey, createdAt)
secrets   — encrypted values (id, projectId, env, key, encryptedValue, updatedAt)
audit     — access log (id, projectId, action, env, requestedAt, ip)
nonces    — replay prevention (nonce, expiresAt)
```

The `secrets.encryptedValue` field stores the AES-256-GCM ciphertext as a base64-encoded string. The IV is prepended to the ciphertext. The master key is never stored in the database.

## Production deployment

### Build for production

```bash
# Build the dashboard
vp build

# Compile the vault
vp run server:build

# Start the compiled vault
vp run server:start
```

The compiled vault is a single Bun bundle in `apps/server/dist/`.

### Reverse proxy with Caddy (recommended)

The vault must be behind HTTPS in production. Ed25519 signatures provide authentication, but not transport encryption — use TLS for all production traffic.

```
# /etc/caddy/Caddyfile
vault.example.com {
  reverse_proxy localhost:4200
}
```

```bash
caddy run
```

Caddy automatically provisions and renews TLS certificates via Let's Encrypt.

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

```bash
docker build -t opaque-vault .
docker run -p 4200:4200 \
  -e OPAQUE_MASTER_KEY="..." \
  -e OPAQUE_ADMIN_TOKEN="..." \
  -e DATABASE_URL="libsql://..." \
  opaque-vault
```

For persistent local SQLite in Docker, mount a volume:

```bash
docker run -p 4200:4200 \
  -e OPAQUE_MASTER_KEY="..." \
  -e OPAQUE_ADMIN_TOKEN="..." \
  -v /data/opaque:/app/data \
  -e DATABASE_URL="file:./data/opaque.db" \
  opaque-vault
```

### Fly.io

Fly.io is a good fit for opaque: persistent volume for SQLite, automatic TLS, easy secret management.

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Launch (creates fly.toml)
fly launch --name opaque-vault

# Set secrets
fly secrets set \
  OPAQUE_MASTER_KEY="$(openssl rand -hex 32)" \
  OPAQUE_ADMIN_TOKEN="$(openssl rand -hex 32)" \
  DATABASE_URL="file:/data/opaque.db"

# Create a persistent volume for the database
fly volumes create opaque_data --size 1

# Deploy
fly deploy
```

Add to `fly.toml`:

```toml
[mounts]
  source = "opaque_data"
  destination = "/data"
```

For higher availability, use Turso instead of a Fly volume to get edge replication.

## Operational checklist

Before going to production:

- [ ] `OPAQUE_MASTER_KEY` stored in a dedicated secrets manager, not in `.env`
- [ ] `OPAQUE_ADMIN_TOKEN` is a long (64+ char) random value
- [ ] Vault is behind HTTPS (Caddy, nginx, Fly.io auto-TLS)
- [ ] Database backups are configured (Turso handles this automatically)
- [ ] Audit log is reviewed periodically
- [ ] Rate limiting is active (100 req/min per IP, enabled by default)
- [ ] `DATABASE_URL` points to production database, not `file:./opaque.db`
