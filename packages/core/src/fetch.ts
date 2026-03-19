import { signRequest } from "./crypto";
import type { OpaqueConfig, SecretsRecord } from "./types";

export async function fetchSecrets(config: OpaqueConfig): Promise<SecretsRecord> {
  const env =
    config.env ??
    (typeof process !== "undefined" ? process.env.NODE_ENV : "production") ??
    "production";

  const url = `${config.vaultUrl}/v1/secrets?env=${env}`;

  const headers = await signRequest({
    method: "GET",
    url,
    privateKey: config.privateKey,
    projectId: config.project,
  });

  const res = await fetch(url, { method: "GET", headers });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`opaque: failed to fetch secrets (${res.status}) — ${body}`);
  }

  return res.json() as Promise<SecretsRecord>;
}
