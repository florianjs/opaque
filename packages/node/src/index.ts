import { fetchSecrets, injectEnv } from "@opaque/core";

export async function bootstrap(): Promise<void> {
  const secrets = await fetchSecrets({
    vaultUrl: process.env.OPAQUE_VAULT_URL ?? "",
    privateKey: process.env.OPAQUE_PRIVATE_KEY ?? "",
    project: process.env.OPAQUE_PROJECT ?? "",
  });
  injectEnv(secrets, process.env as Record<string, string>);
}
