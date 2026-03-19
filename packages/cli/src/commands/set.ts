import { defineCommand } from "citty";
import { signRequest } from "@opaque/core";

export const setCommand = defineCommand({
  meta: {
    name: "set",
    description: "Create or update a secret (KEY=value)",
  },
  args: {
    project: {
      type: "string",
      description: "Project name",
      required: true,
    },
    env: {
      type: "string",
      description: "Environment (e.g. production, development)",
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
  async run({ args, rawArgs }) {
    const vaultUrl =
      (args["vault-url"] as string) || process.env.OPAQUE_VAULT_URL || "http://localhost:4200";
    const privateKey = (args["private-key"] as string) || process.env.OPAQUE_PRIVATE_KEY || "";
    const project = (args.project as string) || process.env.OPAQUE_PROJECT || "";
    const env = (args.env as string) || "production";

    if (!privateKey) {
      throw new Error("opaque: private key required — set OPAQUE_PRIVATE_KEY or use --private-key");
    }

    // Find KEY=value argument from rawArgs (positional args after flags)
    const kvArg = rawArgs.find((a) => a.includes("=") && !a.startsWith("-"));
    if (!kvArg) {
      throw new Error("opaque: expected KEY=value argument");
    }

    const eqIdx = kvArg.indexOf("=");
    const key = kvArg.slice(0, eqIdx);
    const value = kvArg.slice(eqIdx + 1);

    if (!key) {
      throw new Error("opaque: invalid KEY=value format — key cannot be empty");
    }

    const url = `${vaultUrl}/v1/secrets`;
    const headers = await signRequest({
      method: "PUT",
      url,
      privateKey,
      projectId: project,
    });

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify({ key, value, env }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`opaque: failed to set secret (${res.status}) — ${body}`);
    }

    console.log(`Set ${key} [${env}]`);
  },
});
