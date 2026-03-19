import { defineNuxtModule } from "@nuxt/kit";
import { fetchSecrets, injectEnv } from "@florianjs/opaque";

export default defineNuxtModule({
  meta: { name: "opaque", configKey: "opaque" },
  defaults: {
    vaultUrl: process.env.OPAQUE_VAULT_URL ?? "http://localhost:4200",
    privateKey: process.env.OPAQUE_PRIVATE_KEY ?? "",
    project: process.env.OPAQUE_PROJECT ?? "",
  },
  async setup(options, nuxt) {
    nuxt.hook("nitro:init", async () => {
      const secrets = await fetchSecrets({
        ...options,
        env: process.env.NODE_ENV,
      });
      injectEnv(secrets, process.env as Record<string, string>);
    });
  },
});
