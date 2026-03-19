import { defineCommand } from "citty";
import { fetchSecrets } from "@florianjs/opaque";

export const pullCommand = defineCommand({
  meta: {
    name: "pull",
    description: "Dump secrets to stdout as KEY=value lines",
  },
  args: {
    project: {
      type: "string",
      description: "Project name",
      required: true,
    },
    env: {
      type: "string",
      description: "Environment",
      default: "production",
    },
    "vault-url": {
      type: "string",
      description: "Vault URL",
      default: "",
    },
    "private-key": {
      type: "string",
      description: "Ed25519 private key JWK (or set OPAQUE_PRIVATE_KEY)",
      default: "",
    },
  },
  async run({ args }) {
    const vaultUrl =
      (args["vault-url"] as string) || process.env.OPAQUE_VAULT_URL || "http://localhost:4200";
    const privateKey = (args["private-key"] as string) || process.env.OPAQUE_PRIVATE_KEY || "";
    const project = (args.project as string) || process.env.OPAQUE_PROJECT || "";
    const env = (args.env as string) || "production";

    if (!privateKey) {
      throw new Error("opaque: private key required — set OPAQUE_PRIVATE_KEY or use --private-key");
    }

    const secrets = await fetchSecrets({
      vaultUrl,
      privateKey,
      project,
      env,
    });

    for (const [key, value] of Object.entries(secrets)) {
      // Quote value if it contains spaces or special chars
      const needsQuotes = /[\s"'\\$`]/.test(value);
      const outputValue = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value;
      console.log(`${key}=${outputValue}`);
    }
  },
});
