import { Hono } from "hono";
import { db } from "../db/client";
import { projects, secrets } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { encrypt } from "../crypto/aes";

const app = new Hono();

// GET /v1/admin/projects — list all projects
app.get("/", async (c) => {
  const rows = await db.query.projects.findMany();
  return c.json(
    rows.map((p) => ({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
    })),
  );
});

// POST /v1/admin/projects — create project
app.post("/", async (c) => {
  const body = await c.req.json<{
    id?: string;
    name?: string;
    publicKey: string;
  }>();

  const id = body.id ?? randomUUID();
  const name = body.name ?? id;
  const { publicKey } = body;

  if (!publicKey) {
    return c.json({ error: "opaque: publicKey is required" }, 400);
  }

  const existing = await db.query.projects.findFirst({
    where: (p, { eq: eqFn }) => eqFn(p.id, id),
  });

  if (existing) {
    return c.json({ error: `opaque: project "${id}" already exists` }, 409);
  }

  await db.insert(projects).values({
    id,
    name,
    publicKey,
    createdAt: new Date(),
  });

  return c.json({ id, name, publicKey }, 201);
});

// DELETE /v1/admin/projects/:id — delete project
app.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await db.query.projects.findFirst({
    where: (p, { eq: eqFn }) => eqFn(p.id, id),
  });

  if (!existing) {
    return c.json({ error: "opaque: project not found" }, 404);
  }

  await db.delete(projects).where(eq(projects.id, id));

  return c.json({ ok: true });
});

// GET /v1/admin/projects/:id/secrets — list secrets (keys only)
app.get("/:id/secrets", async (c) => {
  const projectId = c.req.param("id");
  const env = c.req.query("env");

  const project = await db.query.projects.findFirst({
    where: (p, { eq: eqFn }) => eqFn(p.id, projectId),
  });

  if (!project) {
    return c.json({ error: "opaque: project not found" }, 404);
  }

  const rows = await db.query.secrets.findMany({
    where: (s, { and: andFn, eq: eqFn }) =>
      env ? andFn(eqFn(s.projectId, projectId), eqFn(s.env, env)) : eqFn(s.projectId, projectId),
  });

  return c.json(
    rows.map((s) => ({
      id: s.id,
      key: s.key,
      env: s.env,
      updatedAt: s.updatedAt,
    })),
  );
});

// POST /v1/admin/projects/:id/secrets — create/update a secret via dashboard
app.post("/:id/secrets", async (c) => {
  const projectId = c.req.param("id");
  const body = await c.req.json<{ key: string; value: string; env?: string }>();
  const { key, value } = body;
  const env = body.env ?? "production";

  if (!key || value === undefined) {
    return c.json({ error: "opaque: key and value are required" }, 400);
  }

  const project = await db.query.projects.findFirst({
    where: (p, { eq: eqFn }) => eqFn(p.id, projectId),
  });
  if (!project) {
    return c.json({ error: "opaque: project not found" }, 404);
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

  return c.json({ ok: true }, 201);
});

// DELETE /v1/admin/secrets/:id — delete a secret
app.delete("/secrets/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await db.query.secrets.findFirst({
    where: (s, { eq: eqFn }) => eqFn(s.id, id),
  });

  if (!existing) {
    return c.json({ error: "opaque: secret not found" }, 404);
  }

  await db.delete(secrets).where(eq(secrets.id, id));

  return c.json({ ok: true });
});

export { app as projectsRoutes };
