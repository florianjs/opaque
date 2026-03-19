import * as ed from "@noble/ed25519";

// @noble/ed25519 v2 requires sha512 to be set explicitly
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

export interface VerifySignatureParams {
  method: string;
  url: string;
  headers: Record<string, string>;
  publicKey: string; // hex-encoded Ed25519 public key
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

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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

export async function verifySignature(params: VerifySignatureParams): Promise<boolean> {
  const { method, url, publicKey, signature, signatureInput } = params;

  try {
    // Parse signature-input
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
    const sigMatch = signature.match(/sig1=:([^:]+):/);
    if (!sigMatch) {
      return false;
    }
    const signatureBase64 = sigMatch[1];
    const signatureBytes = base64ToBytes(signatureBase64);

    // Rebuild canonical message
    const canonicalMessage = buildCanonicalMessage(method, url, created, expires, nonce, keyId);

    const messageBytes = new TextEncoder().encode(canonicalMessage);
    const publicKeyBytes = hexToBytes(publicKey);

    return await ed.verifyAsync(signatureBytes, messageBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

export function extractProjectId(signatureAgent: string): string {
  // Format: sig1=<projectId>.agents.opaque.local;pubkey="..."
  const match = signatureAgent.match(/sig1=([^.]+)\.agents\.opaque\.local/);
  if (!match) {
    throw new Error("opaque: invalid signature-agent format");
  }
  return match[1];
}

export function extractNonce(signatureInput: string): string | null {
  const match = signatureInput.match(/nonce="([^"]+)"/);
  return match ? match[1] : null;
}

export function extractCreatedExpires(
  signatureInput: string,
): { created: number; expires: number } | null {
  const createdMatch = signatureInput.match(/created=(\d+)/);
  const expiresMatch = signatureInput.match(/expires=(\d+)/);
  if (!createdMatch || !expiresMatch) return null;
  return {
    created: parseInt(createdMatch[1], 10),
    expires: parseInt(expiresMatch[1], 10),
  };
}
