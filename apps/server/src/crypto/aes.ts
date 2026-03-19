function hexToBytes(hex: string): Uint8Array {
  if (hex.length !== 64) {
    throw new Error("opaque: OPAQUE_MASTER_KEY must be a 32-byte (64 hex char) hex string");
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 64; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
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

async function getMasterKey(): Promise<CryptoKey> {
  const masterKeyHex = process.env.OPAQUE_MASTER_KEY;
  if (!masterKeyHex) {
    throw new Error("opaque: OPAQUE_MASTER_KEY environment variable is not set");
  }

  const keyBytes = hexToBytes(masterKeyHex);

  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encrypt(value: string): Promise<string> {
  const key = await getMasterKey();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const encoded = new TextEncoder().encode(value);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  const ivBase64 = bytesToBase64(iv);
  const ciphertextBase64 = bytesToBase64(new Uint8Array(ciphertext));

  return `${ivBase64}.${ciphertextBase64}`;
}

export async function decrypt(encrypted: string): Promise<string> {
  const key = await getMasterKey();

  const dotIdx = encrypted.indexOf(".");
  if (dotIdx === -1) {
    throw new Error("opaque: invalid encrypted value format — expected iv.ciphertext");
  }

  const ivBase64 = encrypted.slice(0, dotIdx);
  const ciphertextBase64 = encrypted.slice(dotIdx + 1);

  const iv = base64ToBytes(ivBase64);
  const ciphertext = base64ToBytes(ciphertextBase64);

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);

  return new TextDecoder().decode(decrypted);
}
