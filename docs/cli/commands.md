# CLI Commands

The `@opaque/cli` package provides the `opaque` command for managing your vault from the terminal.

## Installation

```bash
npm install -g @opaque/cli
```

## Environment variables

All commands require these environment variables (or pass them as flags):

```bash
export OPAQUE_VAULT_URL="https://vault.example.com"
export OPAQUE_ADMIN_TOKEN="<your admin token>"
```

---

## `opaque init`

Interactive setup wizard. Guides you through configuring your vault URL and admin token, then optionally registers a first project.

```bash
opaque init
```

The wizard prompts for:
- Vault URL
- Admin token
- Whether to register a first project

Configuration is saved to `~/.opaque/config.json` and used as defaults for subsequent commands.

---

## `opaque register`

Register a new project on the vault. Generates an Ed25519 keypair: the vault stores the public key, and you store the private key in your CI/CD.

```bash
opaque register --project <name>
```

**Flags:**

| Flag | Required | Description |
|---|---|---|
| `--project` | yes | Project name (used as the identifier in all other commands) |

**Output:**

```
OPAQUE_PRIVATE_KEY={"kty":"OKP","crv":"Ed25519","d":"...","x":"..."}
```

::: warning Save the key immediately
The private key is printed only once. If you lose it, you must rotate to get a new one. Add it to your CI/CD secrets immediately after running this command.
:::

**Example:**

```bash
opaque register --project my-app
# Add the printed OPAQUE_PRIVATE_KEY to your CI/CD secrets

opaque register --project api-service
opaque register --project workers-queue
```

---

## `opaque set`

Create or update a secret. If the key already exists for the given project and environment, its value is overwritten.

```bash
opaque set --project <name> --env <env> KEY=value
```

**Flags:**

| Flag | Required | Description |
|---|---|---|
| `--project` | yes | Project name |
| `--env` | yes | Environment name (any string: `production`, `development`, `pr-123`, etc.) |

**Examples:**

```bash
# Set secrets for production
opaque set --project my-app --env production DATABASE_URL="postgres://prod-host/myapp"
opaque set --project my-app --env production STRIPE_SECRET_KEY="sk_live_..."
opaque set --project my-app --env production OPENAI_API_KEY="sk-..."

# Set secrets for development
opaque set --project my-app --env development DATABASE_URL="postgres://localhost/myapp_dev"

# Use branch names or PR numbers as environments
opaque set --project my-app --env pr-456 DATABASE_URL="postgres://staging/myapp_pr456"
```

::: tip Quoting values
Always quote values that contain special characters, spaces, or equals signs:
```bash
opaque set --project my-app --env production JDBC_URL="jdbc:postgresql://host:5432/db?user=app&password=secret"
```
:::

---

## `opaque get`

Print the current value of a single secret. Useful for scripting or debugging.

```bash
opaque get --project <name> --env <env> KEY
```

**Flags:**

| Flag | Required | Description |
|---|---|---|
| `--project` | yes | Project name |
| `--env` | yes | Environment name |

**Examples:**

```bash
opaque get --project my-app --env production DATABASE_URL
# postgres://prod-host/myapp

# Use in a script
DB=$(opaque get --project my-app --env production DATABASE_URL)
psql "$DB" -c "SELECT count(*) FROM users"
```

---

## `opaque list`

List all secret keys for a project and environment. Values are never shown.

```bash
opaque list --project <name> --env <env>
```

**Flags:**

| Flag | Required | Description |
|---|---|---|
| `--project` | yes | Project name |
| `--env` | yes | Environment name |

**Example:**

```bash
opaque list --project my-app --env production
# DATABASE_URL        production   2026-03-19
# STRIPE_SECRET_KEY   production   2026-03-19
# OPENAI_API_KEY      production   2026-03-19
```

Output columns: `KEY_NAME`, `environment`, `last updated date`.

---

## `opaque rotate`

Rotate the Ed25519 keypair for a project. The old key remains valid for a 10-minute overlap window to allow zero-downtime redeployment.

```bash
opaque rotate --project <name>
```

**Flags:**

| Flag | Required | Description |
|---|---|---|
| `--project` | yes | Project name |

**Example:**

```bash
opaque rotate --project my-app
# Rotating keypair for project: my-app
# New OPAQUE_PRIVATE_KEY={"kty":"OKP","crv":"Ed25519","d":"...","x":"..."}
#
# Old key will remain valid for 10 minutes.
# Update OPAQUE_PRIVATE_KEY in your deployment and redeploy within that window.
```

See [Key Rotation](/guide/key-rotation) for the full rotation workflow.

---

## `opaque pull`

Dump all secrets for a project and environment to stdout in `KEY=value` format. Useful for shell scripting, local development setup, or piping into other tools.

```bash
opaque pull --project <name> --env <env>
```

**Flags:**

| Flag | Required | Description |
|---|---|---|
| `--project` | yes | Project name |
| `--env` | yes | Environment name |

**Examples:**

```bash
opaque pull --project my-app --env production
# DATABASE_URL=postgres://prod-host/myapp
# STRIPE_SECRET_KEY=sk_live_...
# OPENAI_API_KEY=sk-...

# Source into current shell
eval "$(opaque pull --project my-app --env development)"
echo $DATABASE_URL

# Write to a local .env file (for local dev only — never commit)
opaque pull --project my-app --env development > .env.local
```

::: warning Sensitive output
`opaque pull` prints secret values in plaintext. Pipe it carefully — avoid writing values to shared logs, CI/CD output streams, or anywhere they might be captured.
:::

---

## `opaque audit`

Show recent access log entries for a project. Every secret fetch is logged.

```bash
opaque audit --project <name>
```

**Flags:**

| Flag | Required | Description |
|---|---|---|
| `--project` | yes | Project name |
| `--limit` | no | Number of entries to show (default: 50) |

**Example:**

```bash
opaque audit --project my-app
# 2026-03-19 12:00:01   fetch   production   10.0.0.5
# 2026-03-19 11:59:55   fetch   production   10.0.0.6
# 2026-03-19 11:45:12   fetch   development  192.168.1.10
# 2026-03-19 09:00:00   rotate  —            192.168.1.1

opaque audit --project my-app --limit 10
```

Output columns: `timestamp`, `action`, `environment`, `IP address`.

Actions logged: `fetch` (secret retrieval), `rotate` (keypair rotation).
