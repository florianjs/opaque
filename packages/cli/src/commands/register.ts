import { defineCommand } from "citty";
import * as ed from "@noble/ed25519";

// @noble/ed25519 v2 requires sha512 to be configured
ed.etc.sha512Async = async (...msgs: Uint8Array[]): Promise<Uint8Array> => {
  const data = new Uint8Array(msgs.reduce((acc, m) => acc + m.length, 0));
  let offset = 0;
  for (const msg of msgs) {
    data.set(msg, offset);
    offset += msg.length;
  }
  const hash = await crypto.subtle.digest("SHA-512", data);
  return new Uint8Array(hash);
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function generateEd25519Keypair(): Promise<{
  privateKeyJwk: string;
  publicKeyHex: string;
}> {
  const privateKeyBytes = ed.utils.randomPrivateKey();
  const publicKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes);

  const privateKeyJwk = JSON.stringify({
    kty: "OKP",
    crv: "Ed25519",
    d: bytesToBase64Url(privateKeyBytes),
    x: bytesToBase64Url(publicKeyBytes),
  });

  return {
    privateKeyJwk,
    publicKeyHex: bytesToHex(publicKeyBytes),
  };
}

export const registerCommand = defineCommand({
  meta: {
    name: "register",
    description: "Register a new project and generate an Ed25519 keypair",
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

    if (!adminToken) {
      throw new Error("opaque: admin token required — set OPAQUE_ADMIN_TOKEN or use --token");
    }

    const { privateKeyJwk, publicKeyHex } = await generateEd25519Keypair();

    const res = await fetch(`${vaultUrl}/v1/admin/projects`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        id: args.project as string,
        publicKey: publicKeyHex,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`opaque: failed to register project (${res.status}) — ${body}`);
    }

    console.log(`\nProject "${args.project as string}" registered.\n`);
    console.log("Add this to your CI/CD secrets:\n");
    console.log(`OPAQUE_PRIVATE_KEY='${privateKeyJwk}'`);
    console.log(`OPAQUE_VAULT_URL='${vaultUrl}'`);
    console.log(`OPAQUE_PROJECT='${args.project as string}'\n`);
    console.log("Keep OPAQUE_PRIVATE_KEY secret — this is the only copy of the private key.");
  },
});
