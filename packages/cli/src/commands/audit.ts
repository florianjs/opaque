import { defineCommand } from "citty";

interface AuditEntry {
  id: string;
  projectId: string;
  action: string;
  env: string | null;
  requestedAt: string;
  ip: string | null;
}

export const auditCommand = defineCommand({
  meta: {
    name: "audit",
    description: "Show recent access log for a project",
  },
  args: {
    project: {
      type: "string",
      description: "Project name",
      required: true,
    },
    limit: {
      type: "string",
      description: "Number of entries to show",
      default: "50",
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
    const limit = args.limit as string;

    if (!adminToken) {
      throw new Error("opaque: admin token required — set OPAQUE_ADMIN_TOKEN or use --token");
    }

    const url = `${vaultUrl}/v1/admin/audit?projectId=${encodeURIComponent(project)}&limit=${limit}`;

    const res = await fetch(url, {
      headers: { authorization: `Bearer ${adminToken}` },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`opaque: failed to fetch audit log (${res.status}) — ${body}`);
    }

    const entries = (await res.json()) as AuditEntry[];

    if (entries.length === 0) {
      console.log("No audit entries found.");
      return;
    }

    console.log(`TIMESTAMP                  ACTION    ENV          IP`);
    console.log("-".repeat(70));

    for (const entry of entries) {
      const ts = new Date(entry.requestedAt).toISOString().replace("T", " ").slice(0, 19);
      const action = entry.action.padEnd(9);
      const env = (entry.env ?? "-").padEnd(12);
      const ip = entry.ip ?? "-";
      console.log(`${ts}  ${action} ${env} ${ip}`);
    }
  },
});
