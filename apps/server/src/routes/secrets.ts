import { Hono } from "hono";
import { encrypt, decrypt } from "../crypto/aes";
import { db } from "../db/client";
import { secrets, audit } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const app = new Hono<{ Variables: { projectId: string } }>();

// GET /v1/secrets?env=production — fetch and decrypt secrets (Ed25519 auth)
app.get("/", async (c) => {
  const projectId = c.get("projectId");
  const env = c.req.query("env") ?? "production";

  const rows = await db.query.secrets.findMany({
    where: (s, { and: andFn, eq: eqFn }) => andFn(eqFn(s.projectId, projectId), eqFn(s.env, env)),
  });

  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = await decrypt(row.encryptedValue);
  }

  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? null;

  await db.insert(audit).values({
    id: randomUUID(),
    projectId,
    action: "fetch",
    env,
    requestedAt: new Date(),
    ip,
  });

  return c.json(result);
});

// PUT /v1/secrets — create or update a secret (Ed25519 auth)
app.put("/", async (c) => {
  const projectId = c.get("projectId");
  const body = await c.req.json<{ key: string; value: string; env?: string }>();
  const { key, value } = body;
  const env = body.env ?? "production";

  if (!key || value === undefined) {
    return c.json({ error: "opaque: key and value are required" }, 400);
  }

  const encrypted = await encrypt(value);
  const now = new Date();

  await db
    .insert(secrets)
    .values({
      id: randomUUID(),
      projectId,
      key,
      encryptedValue: encrypted,
      env,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [secrets.projectId, secrets.env, secrets.key],
      set: { encryptedValue: encrypted, updatedAt: now },
    });

  return c.json({ ok: true });
});

// DELETE /v1/secrets/:id — delete a secret (Ed25519 auth)
app.delete("/:id", async (c) => {
  const projectId = c.get("projectId");
  const id = c.req.param("id");

  const existing = await db.query.secrets.findFirst({
    where: (s, { and: andFn, eq: eqFn }) => andFn(eqFn(s.id, id), eqFn(s.projectId, projectId)),
  });

  if (!existing) {
    return c.json({ error: "opaque: secret not found" }, 404);
  }

  await db.delete(secrets).where(and(eq(secrets.id, id), eq(secrets.projectId, projectId)));

  return c.json({ ok: true });
});

export { app as secretsRoutes };
