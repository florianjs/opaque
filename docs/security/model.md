# Security Model

## Threat model

| Threat                                        | Mitigation                                                                                                                                       | Residual risk                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| **Secret values leaked to LLM/agent context** | SDK injects secrets server-side at boot, after context is established. Dashboard is write-only — values never displayed.                         | Agent with shell access and `OPAQUE_PRIVATE_KEY` can still call `opaque pull`. All access logged. |
| **Secrets in git history**                    | Values never written to files — only the Ed25519 private key goes in CI/CD.                                                                      | Developer accidentally hardcodes a value in code before using opaque.                             |
| **Replay attack**                             | Every request requires a unique nonce + `expires` timestamp. Nonces are cached for 10 minutes. Requests outside a ±5-minute window are rejected. | Clock skew > 5 minutes between client and vault.                                                  |
| **Private key stolen**                        | `opaque rotate` — old key invalid after 10-minute overlap window.                                                                                | Window between key theft and detection. Review audit log regularly.                               |
| **Man-in-the-middle (MITM)**                  | TLS required in production. The vault must be behind HTTPS.                                                                                      | Incorrect TLS configuration (self-signed certs accepted by clients).                              |
| **Secrets at rest**                           | AES-256-GCM encryption. Master key in env var, never in the database.                                                                            | Compromise of the host running the vault.                                                         |
| **Unauthorized admin access**                 | Separate `OPAQUE_ADMIN_TOKEN` for management operations. Not used by applications.                                                               | Weak or leaked admin token.                                                                       |
| **Brute force / credential stuffing**         | Rate limiting: 100 requests/minute per IP on all `/v1/*` routes.                                                                                 | Distributed attack from many IPs.                                                                 |
| **Database compromise**                       | Secret values are AES-256-GCM encrypted. An attacker with database access sees only ciphertext.                                                  | Master key compromise combined with database access.                                              |

## Authentication flow

Every application request to `/v1/secrets` goes through this flow:

```
1. Project boot
   └─ Read OPAQUE_PRIVATE_KEY from process.env

2. signRequest() — in @florianjs/opaque/crypto.ts
   ├─ Parse Ed25519 private key from JWK JSON
   ├─ Derive public key from private key bytes
   ├─ Generate 128-bit random nonce
   ├─ Set created = now(), expires = now() + 300s
   ├─ Build RFC 9421 canonical message:
   │     "@method": GET
   │     "@authority": vault.example.com
   │     "@target-uri": https://vault.example.com/v1/secrets?env=production
   │     "@signature-params": (...);created=...;expires=...;nonce="...";keyid="..."
   └─ Sign canonical message with Ed25519 → base64 signature

3. HTTP request
   GET /v1/secrets?env=production
   Signature:       sig1=:<base64>:
   Signature-Input: sig1=("@method" "@authority" "@target-uri");created=...;expires=...;nonce="...";keyid="my-app.agents.opaque.local"
   Signature-Agent: sig1=my-app.agents.opaque.local;pubkey="<hex>"

4. Vault authMiddleware
   ├─ Extract projectId from Signature-Agent header
   ├─ Look up project.publicKey from database
   ├─ Parse Signature-Input: extract created, expires, nonce, keyid
   ├─ Verify time window: now must be within [created-300, expires+300]
   ├─ Check nonce not in nonces table (replay prevention)
   ├─ Rebuild canonical message from request method, URL, and sig-params
   ├─ Verify Ed25519 signature over canonical message using project.publicKey
   ├─ During rotation: also try project.rotatingPublicKey if not expired
   ├─ Insert nonce into nonces table with expiresAt = now() + 10min
   └─ Set ctx.projectId → pass to route handler

5. Vault route handler
   ├─ Query secrets WHERE projectId = ctx.projectId AND env = ?
   ├─ Decrypt each encryptedValue with AES-256-GCM using OPAQUE_MASTER_KEY
   ├─ Write audit log entry (projectId, action="fetch", env, ip, requestedAt)
   └─ Return { KEY: "value", ... }

6. SDK injectEnv()
   └─ Merge secrets into process.env
```

## Cryptographic details

### Ed25519 signatures

- Library: `@noble/ed25519` (audited, zero-dependency)
- Key format: JWK with `"kty":"OKP","crv":"Ed25519"` — private key in `d`, public key in `x` (base64url)
- Signing uses async SHA-512 via WebCrypto `crypto.subtle.digest("SHA-512", ...)`
- Signature is 64 bytes, base64-encoded in the `Signature` header

### AES-256-GCM encryption at rest

- Cipher: AES-256-GCM (authenticated encryption with associated data)
- Key: 32-byte hex from `OPAQUE_MASTER_KEY`, imported via `crypto.subtle.importKey`
- IV: 12 random bytes prepended to the ciphertext, generated fresh for each encryption
- Stored format: `<12-byte IV><ciphertext>` as a hex or base64 string

```ts
// Conceptual — from apps/server/src/crypto/aes.ts
async function encrypt(value: string): Promise<string> {
  const key = await importMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );
  return encode([...iv, ...new Uint8Array(ciphertext)]);
}
```

### Nonce replay prevention

Nonces are stored in the `nonces` table for 10 minutes:

```
nonces(nonce TEXT PRIMARY KEY, expiresAt INTEGER)
```

The vault periodically cleans up expired nonces. A nonce can only be used once within the 10-minute window. Since request signatures expire after 5 minutes, and nonces are retained for 10 minutes, no valid request can be replayed.

## What opaque protects vs. does not protect

### Protected

- Secret values never appear in `.env` files, source code, or git history
- Secret values never appear in the LLM's passive context (file reads, grep, etc.)
- Secret values never appear in the dashboard — the UI is write-only
- All access is logged in the audit table with timestamp and IP

### Not protected against

- An AI agent that has been explicitly given shell access **and** `OPAQUE_PRIVATE_KEY` can retrieve secrets using `opaque pull` or a direct signed API call. This is intentional — the agent is acting as the authenticated application. The audit log captures this.
- An attacker with access to the vault host and `OPAQUE_MASTER_KEY` can decrypt all stored secrets.
- Secrets are decrypted in memory and returned in plaintext to authenticated applications — they are not end-to-end encrypted.

## Key management recommendations

### OPAQUE_MASTER_KEY

- Store in a dedicated secrets manager (AWS Secrets Manager, HashiCorp Vault, 1Password Secrets Automation)
- Never store in the vault's own database
- Never commit to version control
- Rotate periodically — requires re-encrypting all stored secrets (see [Key Rotation](/guide/key-rotation))
- Use a unique key per environment (development, staging, production)

### OPAQUE_ADMIN_TOKEN

- Generate with `openssl rand -hex 32` (64 hex chars, 256 bits)
- Store in the same secrets manager as `OPAQUE_MASTER_KEY`
- Rotate periodically — update in vault environment and re-configure the CLI
- Never share between development and production environments

### Project private keys (OPAQUE_PRIVATE_KEY)

- Store in your CI/CD platform's secrets store (GitHub Actions Secrets, Vercel Environment Variables, etc.)
- Rotate with `opaque rotate --project <name>` — zero-downtime with 10-minute overlap
- Use separate projects for separate services — never share a private key between multiple applications
- After a suspected compromise, rotate immediately

## Network security

- **Always** deploy the vault behind HTTPS in production
- Ed25519 signatures authenticate the request but do not encrypt it — TLS is required for transport security
- Restrict network access to the vault: it should not be publicly reachable if possible — use private networking between your app servers and the vault
- The vault binds to `0.0.0.0` by default — in production, bind to a specific interface or use a firewall rule
