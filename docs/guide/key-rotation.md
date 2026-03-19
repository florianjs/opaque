# Key Rotation

opaque supports zero-downtime key rotation for any project. When you rotate, both the old and new keys are accepted for a 10-minute overlap window, giving you time to redeploy your application with the new key.

## How it works

The vault schema stores two public keys per project:

```
projects
  ├── publicKey            — the current active public key
  ├── rotatingPublicKey    — the previous key (set during rotation)
  └── rotatingKeyExpiresAt — when the previous key stops being accepted
```

During the overlap window, `authMiddleware` accepts signatures from either the current key or the rotating key. After `rotatingKeyExpiresAt`, the rotating key is ignored.

```
Time →
|------ old key valid ------|
                        |-- overlap (10 min) --|
                             |------- new key valid ------->
```

## Step-by-step rotation

### 1. Generate new keypair

```bash
export OPAQUE_VAULT_URL="https://vault.example.com"
export OPAQUE_ADMIN_TOKEN="<your admin token>"

opaque rotate --project my-app
```

Output:

```
Rotating keypair for project: my-app
New OPAQUE_PRIVATE_KEY={"kty":"OKP","crv":"Ed25519","d":"<new-private>","x":"<new-public>"}

Old key will remain valid for 10 minutes.
Update OPAQUE_PRIVATE_KEY in your deployment and redeploy within that window.
```

The vault immediately stores the new public key as `publicKey` and moves the old one to `rotatingPublicKey` with an expiry 10 minutes from now.

### 2. Update your deployment secret

In your CI/CD or secrets manager, update `OPAQUE_PRIVATE_KEY` to the new value printed by `opaque rotate`.

::: tip Platform-specific instructions

**GitHub Actions:**
Go to Settings → Secrets and variables → Actions → Update `OPAQUE_PRIVATE_KEY`

**Vercel:**
`vercel env rm OPAQUE_PRIVATE_KEY && vercel env add OPAQUE_PRIVATE_KEY`

**Fly.io:**
`fly secrets set OPAQUE_PRIVATE_KEY='{"kty":"OKP",...}'`

**AWS:**
Update the parameter in AWS Systems Manager Parameter Store or Secrets Manager
:::

### 3. Redeploy your application

Deploy with the new `OPAQUE_PRIVATE_KEY`. Your application will pick up the new key at boot. If multiple instances are running, the old instances continue to work with the old key until the overlap window expires.

::: warning Redeploy within 10 minutes
The old key is only valid for 10 minutes after rotation. If your deployment takes longer, the old instances will start receiving `401 invalid_signature` errors. Plan accordingly — for long deployments, consider a maintenance window or use a staged rollout that completes within the window.
:::

### 4. Verify

```bash
# Check the audit log — look for successful fetches after rotation
opaque audit --project my-app

# Or check vault health
curl https://vault.example.com/health
```

After 10 minutes, the vault automatically drops the old key. Any instance still using the old key will fail to authenticate and must be restarted with the new key.

## Emergency rotation

If a private key is compromised (exposed in logs, leaked in a repository, etc.):

```bash
# Rotate immediately — the old key is invalidated after 10 minutes
opaque rotate --project my-app

# Update and redeploy your application immediately
# Any requests using the old key will fail after 10 minutes
```

If you need to invalidate the old key immediately (zero tolerance):

1. Delete and recreate the project (this also deletes all stored secrets)
2. Re-add all secrets to the new project
3. Update and redeploy your application

## Rotating OPAQUE_MASTER_KEY

Rotating the vault master key requires re-encrypting all stored secrets. This is a more involved operation:

1. Generate a new master key: `openssl rand -hex 32`
2. Read all secrets with the old key (decrypt), re-encrypt with the new key, and write them back
3. Update `OPAQUE_MASTER_KEY` in your vault's environment
4. Restart the vault

::: warning No built-in master key rotation
opaque does not currently have a built-in command for master key rotation. It requires a custom migration script. Treat `OPAQUE_MASTER_KEY` as a long-lived credential and store it carefully in a dedicated secrets manager from the start.
:::
