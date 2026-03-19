import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./apps/server/opaque.db";

const client = createClient({ url });

export const db = drizzle(client, { schema });

export async function initDb(): Promise<void> {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      public_key TEXT NOT NULL,
      rotating_public_key TEXT,
      rotating_key_expires_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS secrets (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      env TEXT NOT NULL,
      key TEXT NOT NULL,
      encrypted_value TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      CONSTRAINT secrets_project_id_env_key_unique UNIQUE(project_id, env, key)
    );

    CREATE TABLE IF NOT EXISTS audit (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL REFERENCES projects(id),
      action TEXT NOT NULL,
      env TEXT,
      requested_at INTEGER NOT NULL,
      ip TEXT
    );

    CREATE TABLE IF NOT EXISTS nonces (
      nonce TEXT PRIMARY KEY NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);
}
