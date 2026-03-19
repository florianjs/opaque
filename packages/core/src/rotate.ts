import type { OpaqueConfig } from "./types";

export interface RotateKeyResult {
  privateKey: string; // new Ed25519 private key JWK
  publicKey: string; // new Ed25519 public key hex
}

export async function rotateKey(
  config: OpaqueConfig,
  adminToken: string,
): Promise<RotateKeyResult> {
  const url = `${config.vaultUrl}/v1/admin/projects/${encodeURIComponent(config.project)}/rotate`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`opaque: failed to rotate key (${res.status}) — ${body}`);
  }

  const data = (await res.json()) as RotateKeyResult;
  return data;
}
