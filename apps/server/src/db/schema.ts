import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  publicKey: text("public_key").notNull(),
  // For key rotation: stores the previous public key with an expiry
  rotatingPublicKey: text("rotating_public_key"),
  rotatingKeyExpiresAt: integer("rotating_key_expires_at", {
    mode: "timestamp",
  }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const secrets = sqliteTable(
  "secrets",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    env: text("env").notNull(),
    key: text("key").notNull(),
    encryptedValue: text("encrypted_value").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => ({ uniq: unique().on(t.projectId, t.env, t.key) }),
);

export const audit = sqliteTable("audit", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  action: text("action").notNull(),
  env: text("env"),
  requestedAt: integer("requested_at", { mode: "timestamp" }).notNull(),
  ip: text("ip"),
});

export const nonces = sqliteTable("nonces", {
  nonce: text("nonce").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});
