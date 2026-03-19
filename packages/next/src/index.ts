import { fetchSecrets, injectEnv } from "@florianjs/opaque";

// Used as instrumentation.ts in a Next.js project
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const secrets = await fetchSecrets({
      vaultUrl: process.env.OPAQUE_VAULT_URL ?? "",
      privateKey: process.env.OPAQUE_PRIVATE_KEY ?? "",
      project: process.env.OPAQUE_PROJECT ?? "",
    });
    injectEnv(secrets, process.env as Record<string, string>);
  }
}
