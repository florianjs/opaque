import { defineCommand } from "citty";
import { fetchSecrets } from "@florianjs/opaque";

export const getCommand = defineCommand({
  meta: {
    name: "get",
    description: "Get a specific secret value",
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
    key: {
      type: "string",
      description: "Secret key name",
      required: true,
    },
  },
  async run({ args }) {
    const vaultUrl =
      (args["vault-url"] as string) || process.env.OPAQUE_VAULT_URL || "http://localhost:4200";
    const privateKey = (args["private-key"] as string) || process.env.OPAQUE_PRIVATE_KEY || "";
    const project = (args.project as string) || process.env.OPAQUE_PROJECT || "";
    const env = (args.env as string) || "production";
    const keyName = args.key as string;

    if (!privateKey) {
      throw new Error("opaque: private key required — set OPAQUE_PRIVATE_KEY or use --private-key");
    }

    const secrets = await fetchSecrets({
      vaultUrl,
      privateKey,
      project,
      env,
    });

    if (!(keyName in secrets)) {
      throw new Error(`opaque: secret "${keyName}" not found in env "${env}"`);
    }

    console.log(secrets[keyName]);
  },
});
