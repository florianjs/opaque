import { createMiddleware } from "hono/factory";
import {
  verifySignature,
  extractProjectId,
  extractNonce,
  extractCreatedExpires,
} from "../crypto/ed25519";
import { db } from "../db/client";
import { nonces } from "../db/schema";
import { lt } from "drizzle-orm";

declare module "hono" {
  interface ContextVariableMap {
    projectId: string;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const signature = c.req.header("signature");
  const signatureInput = c.req.header("signature-input");
  const signatureAgent = c.req.header("signature-agent");

  if (!signature || !signatureInput || !signatureAgent) {
    return c.json({ error: "opaque: missing_signature" }, 401);
  }

  let projectId: string;
  try {
    projectId = extractProjectId(signatureAgent);
  } catch {
    return c.json({ error: "opaque: invalid_signature_agent" }, 401);
  }

  const project = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, projectId),
  });

  if (!project) {
    return c.json({ error: "opaque: unknown_project" }, 401);
  }

  // Check nonce
  const nonce = extractNonce(signatureInput);
  if (!nonce) {
    return c.json({ error: "opaque: missing_nonce" }, 401);
  }

  // Check time window
  const timing = extractCreatedExpires(signatureInput);
  if (!timing) {
    return c.json({ error: "opaque: invalid_signature_input" }, 401);
  }

  const now = Math.floor(Date.now() / 1000);
  if (now < timing.created - 300 || now > timing.expires + 300) {
    return c.json({ error: "opaque: signature_expired" }, 401);
  }

  // Clean up expired nonces
  await db.delete(nonces).where(lt(nonces.expiresAt, new Date(Date.now())));

  // Check nonce not replayed
  const existingNonce = await db.query.nonces.findFirst({
    where: (n, { eq: eqFn }) => eqFn(n.nonce, nonce),
  });

  if (existingNonce) {
    return c.json({ error: "opaque: replayed_nonce" }, 401);
  }

  // Verify signature (supports key rotation — check both current and rotating key)
  const valid = await verifySignature({
    method: c.req.method,
    url: c.req.url,
    headers: Object.fromEntries(c.req.raw.headers),
    publicKey: project.publicKey,
    signature,
    signatureInput,
  });

  let validRotating = false;
  if (!valid && project.rotatingPublicKey && project.rotatingKeyExpiresAt) {
    const rotatingExpiry = project.rotatingKeyExpiresAt.getTime();
    if (Date.now() < rotatingExpiry) {
      validRotating = await verifySignature({
        method: c.req.method,
        url: c.req.url,
        headers: Object.fromEntries(c.req.raw.headers),
        publicKey: project.rotatingPublicKey,
        signature,
        signatureInput,
      });
    }
  }

  if (!valid && !validRotating) {
    return c.json({ error: "opaque: invalid_signature" }, 401);
  }

  // Store nonce — expire after 10 minutes
  const nonceExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await db.insert(nonces).values({ nonce, expiresAt: nonceExpiresAt });

  c.set("projectId", projectId);
  await next();
});

export const adminMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("authorization");
  const adminToken = process.env.OPAQUE_ADMIN_TOKEN;

  if (!adminToken) {
    return c.json({ error: "opaque: admin token not configured" }, 500);
  }

  if (!authHeader || authHeader !== `Bearer ${adminToken}`) {
    return c.json({ error: "opaque: unauthorized" }, 401);
  }

  await next();
});
