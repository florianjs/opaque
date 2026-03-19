import * as ed from "@noble/ed25519";

// @noble/ed25519 v2 requires sha512 to be set explicitly in non-Node envs
// Use WebCrypto SHA-512 (available in Bun, browsers, Deno)
ed.etc.sha512Sync = (..._msgs: Uint8Array[]): Uint8Array => {
  // Synchronous fallback using a simple SHA-512 — we use async methods only
  throw new Error("opaque: use async ed25519 methods only");
};
ed.etc.sha512Async = async (...msgs: Uint8Array[]): Promise<Uint8Array> => {
  const data = new Uint8Array(msgs.reduce((acc, m) => acc + m.length, 0));
  let offset = 0;
  for (const msg of msgs) {
    data.set(msg, offset);
    offset += msg.length;
  }
  const hash = await crypto.subtle.digest("SHA-512", data);
  return new Uint8Array(hash);
};

export interface SignRequestParams {
  method: string;
  url: string;
  privateKey: string; // Ed25519 private key as JWK JSON string
  projectId: string;
}

export interface SignedHeaders {
  signature: string;
  "signature-input": string;
  "signature-agent": string;
}

export interface VerifySignatureParams {
  method: string;
  url: string;
  headers: Record<string, string>;
  publicKey: string; // Ed25519 public key as hex or JWK JSON string
  signature: string;
  signatureInput: string;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseJwkPrivateKey(jwkString: string): Uint8Array {
  const jwk = JSON.parse(jwkString) as Record<string, string>;
  if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519") {
    throw new Error("opaque: invalid private key JWK — expected OKP Ed25519");
  }
  if (!jwk.d) {
    throw new Error("opaque: invalid private key JWK — missing d parameter");
  }
  // Base64url decode the private key scalar
  const b64 = jwk.d.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return base64ToBytes(padded);
}

function parsePublicKey(publicKeyStr: string): Uint8Array {
  // Support hex-encoded public keys and JWK JSON
  if (publicKeyStr.startsWith("{")) {
    const jwk = JSON.parse(publicKeyStr) as Record<string, string>;
    if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519") {
      throw new Error("opaque: invalid public key JWK — expected OKP Ed25519");
    }
    if (!jwk.x) {
      throw new Error("opaque: invalid public key JWK — missing x parameter");
    }
    const b64 = jwk.x.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return base64ToBytes(padded);
  }
  // Assume hex
  return hexToBytes(publicKeyStr);
}

function buildCanonicalMessage(
  method: string,
  url: string,
  created: number,
  expires: number,
  nonce: string,
  keyId: string,
): string {
  const parsedUrl = new URL(url);
  const authority = parsedUrl.host;
  const targetUri = url;

  const components = [
    `"@method": ${method.toUpperCase()}`,
    `"@authority": ${authority}`,
    `"@target-uri": ${targetUri}`,
  ];

  const sigParams = `("@method" "@authority" "@target-uri");created=${created};expires=${expires};nonce="${nonce}";keyid="${keyId}"`;

  return [...components, `"@signature-params": ${sigParams}`].join("\n");
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}

export async function signRequest(params: SignRequestParams): Promise<SignedHeaders> {
  const { method, url, privateKey, projectId } = params;

  const privateKeyBytes = parseJwkPrivateKey(privateKey);

  // Derive public key from private key
  const publicKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes);
  const publicKeyHex = bytesToHex(publicKeyBytes);

  const created = Math.floor(Date.now() / 1000);
  const expires = created + 300; // 5 minutes
  const nonce = generateNonce();
  const keyId = `${projectId}.agents.opaque.local`;

  const canonicalMessage = buildCanonicalMessage(method, url, created, expires, nonce, keyId);

  const messageBytes = new TextEncoder().encode(canonicalMessage);
  const signatureBytes = await ed.signAsync(messageBytes, privateKeyBytes);
  const signatureBase64 = bytesToBase64(signatureBytes);

  const sigParams = `("@method" "@authority" "@target-uri");created=${created};expires=${expires};nonce="${nonce}";keyid="${keyId}"`;

  return {
    signature: `sig1=:${signatureBase64}:`,
    "signature-input": `sig1=${sigParams}`,
    "signature-agent": `sig1=${keyId};pubkey="${publicKeyHex}"`,
  };
}

export async function verifySignature(params: VerifySignatureParams): Promise<boolean> {
  const { method, url, publicKey, signature, signatureInput } = params;

  try {
    // Parse signature-input
    // Format: sig1=("@method" "@authority" "@target-uri");created=...;expires=...;nonce="...";keyid="..."
    const inputMatch = signatureInput.match(
      /sig1=\(([^)]+)\);created=(\d+);expires=(\d+);nonce="([^"]+)";keyid="([^"]+)"/,
    );
    if (!inputMatch) {
      return false;
    }

    const [, , createdStr, expiresStr, nonce, keyId] = inputMatch;
    const created = parseInt(createdStr, 10);
    const expires = parseInt(expiresStr, 10);

    // Validate time window (5 min tolerance)
    const now = Math.floor(Date.now() / 1000);
    if (now < created - 300 || now > expires + 300) {
      return false;
    }

    // Parse signature value
    // Format: sig1=:<base64>:
    const sigMatch = signature.match(/sig1=:([^:]+):/);
    if (!sigMatch) {
      return false;
    }
    const signatureBase64 = sigMatch[1];
    const signatureBytes = base64ToBytes(signatureBase64);

    // Rebuild canonical message
    const canonicalMessage = buildCanonicalMessage(method, url, created, expires, nonce, keyId);

    const messageBytes = new TextEncoder().encode(canonicalMessage);
    const publicKeyBytes = parsePublicKey(publicKey);

    return await ed.verifyAsync(signatureBytes, messageBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

export { bytesToHex, hexToBytes };
