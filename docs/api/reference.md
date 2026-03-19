# API Reference

The opaque vault exposes two groups of endpoints:

- **Admin endpoints** — authenticated with `Authorization: Bearer <OPAQUE_ADMIN_TOKEN>`. Used by the CLI and dashboard to manage projects and secrets.
- **SDK endpoints** — authenticated with an Ed25519 HTTP Message Signature (RFC 9421). Used by applications to fetch their secrets at boot.
- **Health endpoint** — unauthenticated.

## Base URL

All paths are relative to the vault base URL (default: `http://localhost:4200`).

---

## Health

### `GET /health`

Returns `{ ok: true }` if the vault is running. No authentication required.

```bash
curl http://localhost:4200/health
```

```json
{ "ok": true }
```

---

## Admin endpoints

All admin endpoints require:

```
Authorization: Bearer <OPAQUE_ADMIN_TOKEN>
```

### `GET /v1/admin/projects`

List all registered projects.

```bash
curl -H "Authorization: Bearer $OPAQUE_ADMIN_TOKEN" \
  http://localhost:4200/v1/admin/projects
```

```json
[
  {
    "id": "my-app",
    "name": "my-app",
    "publicKey": "a1b2c3...",
    "createdAt": "2026-03-19T10:00:00.000Z"
  },
  {
    "id": "api-service",
    "name": "api-service",
    "publicKey": "d4e5f6...",
    "createdAt": "2026-03-18T09:00:00.000Z"
  }
]
```

---

### `POST /v1/admin/projects`

Create a new project. Accepts a project name and an Ed25519 public key (JWK or hex).

Normally you use `opaque register` which generates the keypair for you. Use this endpoint directly if you want to supply your own public key.

```bash
curl -X POST \
  -H "Authorization: Bearer $OPAQUE_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-app","publicKey":"a1b2c3..."}' \
  http://localhost:4200/v1/admin/projects
```

**Request body:**

```ts
{
  name: string; // Project identifier — used in Signature-Agent header
  publicKey: string; // Ed25519 public key as hex or JWK JSON string
}
```

**Response:**

```json
{ "ok": true, "id": "my-app" }
```

**Errors:**

| Status | Body                             | Meaning                                 |
| ------ | -------------------------------- | --------------------------------------- |
| `409`  | `{"error":"project_exists"}`     | A project with this name already exists |
| `400`  | `{"error":"invalid_public_key"}` | The public key format is invalid        |

---

### `DELETE /v1/admin/projects/:id`

Delete a project and all its associated secrets (cascade). This is irreversible.

```bash
curl -X DELETE \
  -H "Authorization: Bearer $OPAQUE_ADMIN_TOKEN" \
  http://localhost:4200/v1/admin/projects/my-app
```

**Response:**

```json
{ "ok": true }
```

---

### `PUT /v1/admin/projects/:id/rotate`

Rotate the keypair for a project. Generates a new Ed25519 keypair, stores the new public key, and keeps the old key valid for 10 minutes (the overlap window).

Returns the new private key — store it in your CI/CD immediately.

```bash
curl -X PUT \
  -H "Authorization: Bearer $OPAQUE_ADMIN_TOKEN" \
  http://localhost:4200/v1/admin/projects/my-app/rotate
```

**Response:**

```json
{
  "ok": true,
  "privateKey": "{\"kty\":\"OKP\",\"crv\":\"Ed25519\",\"d\":\"...\",\"x\":\"...\"}"
}
```

---

### `GET /v1/admin/projects/:id/secrets`

List secret metadata (keys and environments) for a project. Values are never returned by this endpoint.

```bash
curl -H "Authorization: Bearer $OPAQUE_ADMIN_TOKEN" \
  http://localhost:4200/v1/admin/projects/my-app/secrets
```

**Query parameters:**

| Parameter | Description                      |
| --------- | -------------------------------- |
| `env`     | Filter by environment (optional) |

```json
[
  {
    "id": "abc123",
    "key": "DATABASE_URL",
    "env": "production",
    "updatedAt": "2026-03-19T10:00:00.000Z"
  },
  {
    "id": "def456",
    "key": "STRIPE_KEY",
    "env": "production",
    "updatedAt": "2026-03-19T10:00:00.000Z"
  }
]
```

---

### `DELETE /v1/admin/secrets/:id`

Delete a single secret by its ID (from the list endpoint above).

```bash
curl -X DELETE \
  -H "Authorization: Bearer $OPAQUE_ADMIN_TOKEN" \
  http://localhost:4200/v1/admin/secrets/abc123
```

**Response:**

```json
{ "ok": true }
```

---

### `GET /v1/admin/audit`

Retrieve the audit log. Optionally filter by project and limit results.

```bash
curl -H "Authorization: Bearer $OPAQUE_ADMIN_TOKEN" \
  "http://localhost:4200/v1/admin/audit?projectId=my-app&limit=20"
```

**Query parameters:**

| Parameter   | Description                                   |
| ----------- | --------------------------------------------- |
| `projectId` | Filter by project ID (optional)               |
| `limit`     | Max entries to return (optional, default 100) |

```json
[
  {
    "id": "log1",
    "projectId": "my-app",
    "action": "fetch",
    "env": "production",
    "requestedAt": "2026-03-19T12:00:01.000Z",
    "ip": "10.0.0.5"
  },
  {
    "id": "log2",
    "projectId": "my-app",
    "action": "rotate",
    "env": null,
    "requestedAt": "2026-03-19T09:00:00.000Z",
    "ip": "192.168.1.1"
  }
]
```

**Action values:**

| Action   | When                                                    |
| -------- | ------------------------------------------------------- |
| `fetch`  | Application fetched secrets via `GET /v1/secrets`       |
| `rotate` | Keypair rotated via `PUT /v1/admin/projects/:id/rotate` |

---

## SDK endpoints

SDK endpoints are authenticated with RFC 9421 HTTP Message Signatures. The `@florianjs/opaque` SDK handles signing automatically — you only need these endpoints if you are implementing a custom client.

### Signature format

Every SDK request must include three headers:

```
Signature:       sig1=:<base64-signature>:
Signature-Input: sig1=("@method" "@authority" "@target-uri");created=<unix>;expires=<unix>;nonce="<hex>";keyid="<project>.agents.opaque.local"
Signature-Agent: sig1=<project>.agents.opaque.local;pubkey="<public-key-hex>"
```

The signed message is:

```
"@method": GET
"@authority": vault.example.com
"@target-uri": https://vault.example.com/v1/secrets?env=production
"@signature-params": ("@method" "@authority" "@target-uri");created=1234567890;expires=1234568190;nonce="a1b2c3d4...";keyid="my-app.agents.opaque.local"
```

The signature is an Ed25519 signature over the UTF-8 encoded canonical message, base64-encoded.

**Constraints:**

- `created` must be within ±5 minutes of the vault's current time
- `expires` is `created + 300` (5 minutes)
- `nonce` must be a unique hex string (16 bytes / 32 hex chars) — replayed nonces are rejected for 10 minutes

---

### `GET /v1/secrets`

Fetch and decrypt all secrets for the authenticated project and environment.

```bash
# Normally called by @florianjs/opaque — manual example:
SIGNATURE_HEADERS=$(node -e "
  const { signRequest } = require('@florianjs/opaque/crypto')
  signRequest({
    method: 'GET',
    url: 'http://localhost:4200/v1/secrets?env=production',
    privateKey: process.env.OPAQUE_PRIVATE_KEY,
    projectId: 'my-app',
  }).then(h => console.log(JSON.stringify(h)))
")
```

**Query parameters:**

| Parameter | Description                                        |
| --------- | -------------------------------------------------- |
| `env`     | Environment name (optional, default: `production`) |

**Response:**

```json
{
  "DATABASE_URL": "postgres://prod-host/myapp",
  "STRIPE_KEY": "sk_live_...",
  "OPENAI_API_KEY": "sk-..."
}
```

**Authentication errors:**

| Status | Body                            | Meaning                                |
| ------ | ------------------------------- | -------------------------------------- |
| `401`  | `{"error":"missing_signature"}` | Required signature headers not present |
| `401`  | `{"error":"unknown_project"}`   | Project not found in the vault         |
| `401`  | `{"error":"invalid_signature"}` | Signature verification failed          |
| `401`  | `{"error":"expired"}`           | Request outside the 5-minute window    |
| `401`  | `{"error":"replayed_nonce"}`    | This nonce was already used            |
| `429`  | `{"error":"rate_limited"}`      | Too many requests from this IP         |

---

### `PUT /v1/secrets`

Create or update a secret. If a secret with the same `projectId + key + env` already exists, its value is overwritten.

```ts
// Request body
{
  key: string; // Secret name (e.g., "DATABASE_URL")
  value: string; // Secret value — encrypted server-side before storage
  env: string; // Environment (e.g., "production")
}
```

```json
// Response
{ "ok": true }
```

---

### `DELETE /v1/secrets/:id`

Delete a secret by ID. The ID can be obtained from `GET /v1/admin/projects/:id/secrets`.

```json
// Response
{ "ok": true }
```
