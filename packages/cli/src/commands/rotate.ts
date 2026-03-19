import { defineCommand } from "citty";

export const rotateCommand = defineCommand({
  meta: {
    name: "rotate",
    description: "Rotate the Ed25519 keypair for a project",
  },
  args: {
    project: {
      type: "string",
      description: "Project name",
      required: true,
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

    if (!adminToken) {
      throw new Error("opaque: admin token required — set OPAQUE_ADMIN_TOKEN or use --token");
    }

    const url = `${vaultUrl}/v1/admin/projects/${encodeURIComponent(project)}/rotate`;

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

    const data = (await res.json()) as { privateKey: string; publicKey: string };

    console.log(`\nKey rotated for project "${project}".\n`);
    console.log("Update this in your CI/CD secrets immediately:\n");
    console.log(`OPAQUE_PRIVATE_KEY='${data.privateKey}'\n`);
    console.log("Old key remains valid for 10 minutes to allow redeployment.");
  },
});
