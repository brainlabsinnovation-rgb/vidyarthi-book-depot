import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import pg from "pg";

const migrationsDirectory = fileURLToPath(new URL("../migrations/", import.meta.url));
const migrationName = /^\d{4}_[a-z0-9_]+\.sql$/;

export async function loadMigrations() {
  const names = (await readdir(migrationsDirectory)).filter((name) => migrationName.test(name)).sort();
  if (names.length === 0) throw new Error("No SQL migrations found.");
  const numbers = names.map((name) => Number(name.slice(0, 4)));
  if (new Set(numbers).size !== numbers.length) throw new Error("Duplicate migration number found.");
  for (let index = 0; index < numbers.length; index += 1) {
    if (numbers[index] !== index + 1) throw new Error(`Expected migration ${String(index + 1).padStart(4, "0")}.`);
  }
  return Promise.all(names.map(async (name) => {
    const sql = await readFile(resolve(migrationsDirectory, name), "utf8");
    if (!sql.trim()) throw new Error(`Migration ${name} is empty.`);
    return { name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
  }));
}

export function createDatabaseClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required. Copy .env.example to .env and set a PostgreSQL connection string.");
  const url = new URL(connectionString);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("DATABASE_URL must be a PostgreSQL URL.");
  return new pg.Client({ connectionString, connectionTimeoutMillis: 10_000 });
}

export async function ensureMigrationTable(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    checksum char(64) NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
}

export async function appliedMigrations(client) {
  const result = await client.query("SELECT name, checksum FROM schema_migrations ORDER BY name");
  return new Map(result.rows.map(({ name, checksum }) => [name, checksum.trim()]));
}

export function verifyHistory(migrations, applied) {
  const available = new Map(migrations.map(({ name, checksum }) => [name, checksum]));
  for (const [name, checksum] of applied) {
    if (!available.has(name)) throw new Error(`Applied migration ${name} is missing from this checkout.`);
    if (available.get(name) !== checksum) throw new Error(`Applied migration ${name} was modified. Add a new migration instead.`);
  }
  let pendingSeen = false;
  for (const migration of migrations) {
    if (!applied.has(migration.name)) pendingSeen = true;
    else if (pendingSeen) throw new Error(`Migration ${migration.name} is applied after an earlier pending migration.`);
  }
}
