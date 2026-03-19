import { Hono } from "hono";
import { db } from "../db/client";
import { desc } from "drizzle-orm";

const app = new Hono();

// GET /v1/admin/audit?projectId=&limit= — list audit log
app.get("/", async (c) => {
  const projectId = c.req.query("projectId");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 500);

  const rows = await db.query.audit.findMany({
    where: projectId ? (a, { eq: eqFn }) => eqFn(a.projectId, projectId) : undefined,
    orderBy: (a) => [desc(a.requestedAt)],
    limit,
  });

  return c.json(
    rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      action: row.action,
      env: row.env,
      requestedAt: row.requestedAt,
      ip: row.ip,
    })),
  );
});

export { app as auditRoutes };
