import { Hono } from "hono";
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
import { db } from "../db/client";
import { projects } from "../db/schema";
import { eq } from "drizzle-orm";

const app = new Hono();

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

// PUT /v1/admin/projects/:id/rotate — rotate keypair
app.put("/:id/rotate", async (c) => {
  const id = c.req.param("id");

  const project = await db.query.projects.findFirst({
    where: (p, { eq: eqFn }) => eqFn(p.id, id),
  });

  if (!project) {
    return c.json({ error: "opaque: project not found" }, 404);
  }

  // Generate new keypair
  const privateKeyBytes = ed.utils.randomPrivateKey();
  const publicKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes);

  const newPublicKeyHex = bytesToHex(publicKeyBytes);
  const newPrivateKeyJwk = JSON.stringify({
    kty: "OKP",
    crv: "Ed25519",
    d: bytesToBase64Url(privateKeyBytes),
    x: bytesToBase64Url(publicKeyBytes),
  });

  // Store old key as rotating key with 10 minute overlap window
  const rotatingKeyExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db
    .update(projects)
    .set({
      publicKey: newPublicKeyHex,
      rotatingPublicKey: project.publicKey,
      rotatingKeyExpiresAt,
    })
    .where(eq(projects.id, id));

  return c.json({
    privateKey: newPrivateKeyJwk,
    publicKey: newPublicKeyHex,
    rotatingKeyExpiresAt: rotatingKeyExpiresAt.toISOString(),
  });
});

export { app as keysRoutes };
