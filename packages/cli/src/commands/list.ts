import { defineCommand } from "citty";

interface SecretEntry {
  id: string;
  key: string;
  env: string;
  updatedAt: string;
}

export const listCommand = defineCommand({
  meta: {
    name: "list",
    description: "List all secret keys for a project (values masked)",
  },
  args: {
    project: {
      type: "string",
      description: "Project name",
      required: true,
    },
    env: {
      type: "string",
      description: "Filter by environment",
      default: "",
    },
    "vault-url": {
      type: "string",
      description: "Vault URL",
      default: "",
    },
    token: {
      type: "string",
      description: "Admin token (or set OPAQUE_ADMIN_TOKEN)",
      default: "",
    },
  },
  async run({ args }) {
    const vaultUrl =
      (args["vault-url"] as string) || process.env.OPAQUE_VAULT_URL || "http://localhost:4200";
    const adminToken = (args.token as string) || process.env.OPAQUE_ADMIN_TOKEN || "";
    const project = args.project as string;
    const env = args.env as string;

    if (!adminToken) {
      throw new Error("opaque: admin token required — set OPAQUE_ADMIN_TOKEN or use --token");
    }

    const url = `${vaultUrl}/v1/admin/projects/${encodeURIComponent(project)}/secrets${env ? `?env=${env}` : ""}`;

    const res = await fetch(url, {
      headers: { authorization: `Bearer ${adminToken}` },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`opaque: failed to list secrets (${res.status}) — ${body}`);
    }

    const secrets = (await res.json()) as SecretEntry[];

    if (secrets.length === 0) {
      console.log("No secrets found.");
      return;
    }

    const maxKey = Math.max(...secrets.map((s) => s.key.length), 3);
    const maxEnv = Math.max(...secrets.map((s) => s.env.length), 3);

    console.log(`${"KEY".padEnd(maxKey)}  ${"ENV".padEnd(maxEnv)}  UPDATED`);
    console.log("-".repeat(maxKey + maxEnv + 20));

    for (const s of secrets) {
      const date = new Date(s.updatedAt).toISOString().slice(0, 10);
      console.log(`${s.key.padEnd(maxKey)}  ${s.env.padEnd(maxEnv)}  ${date}`);
    }
  },
});
