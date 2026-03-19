import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { printBanner } from "./banner";
import { authMiddleware, adminMiddleware } from "./middleware/auth";
import { rateLimitMiddleware } from "./middleware/ratelimit";
import { secretsRoutes } from "./routes/secrets";
import { projectsRoutes } from "./routes/projects";
import { keysRoutes } from "./routes/keys";
import { auditRoutes } from "./routes/audit";
import { initDb } from "./db/client";

await initDb();

const PORT = Number(process.env.OPAQUE_PORT ?? 4200);

const app = new Hono();

// Rate limiting on all routes
app.use("*", rateLimitMiddleware);

// ── Ed25519-authenticated routes (project SDK) ──────────────────────────────
app.use("/v1/secrets/*", authMiddleware);
app.use("/v1/secrets", authMiddleware);
app.route("/v1/secrets", secretsRoutes);

// ── Admin routes (Bearer token auth) ───────────────────────────────────────
app.use("/v1/admin/*", adminMiddleware);

// Project management
app.route("/v1/admin/projects", projectsRoutes);

// Key rotation
app.route("/v1/admin/projects", keysRoutes);

// Audit log
app.route("/v1/admin/audit", auditRoutes);

// ── Dashboard UI (static) ───────────────────────────────────────────────────
app.use(
  "/ui/*",
  serveStatic({
    root: "./apps/ui/dist",
    rewriteRequestPath: (path) => path.replace(/^\/ui/, ""),
  }),
);

// Redirect /ui to /ui/
app.get("/ui", (c) => c.redirect("/ui/"));

// Health check
app.get("/health", (c) => c.json({ ok: true }));

printBanner(PORT);

export default { port: PORT, fetch: app.fetch };
