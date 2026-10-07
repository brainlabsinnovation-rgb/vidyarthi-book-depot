import { appliedMigrations, createDatabaseClient, ensureMigrationTable, loadMigrations, verifyHistory } from "./shared.mjs";

async function main() {
  const migrations = await loadMigrations();
  const client = createDatabaseClient();
  await client.connect();
  try {
    // A session lock prevents two deploys from applying the same migration concurrently.
    await client.query("SELECT pg_advisory_lock(742928314)");
    try {
      await ensureMigrationTable(client);
      const applied = await appliedMigrations(client);
      verifyHistory(migrations, applied);
      let count = 0;
      for (const migration of migrations) {
        if (applied.has(migration.name)) continue;
        await client.query("BEGIN");
        try {
          await client.query(migration.sql);
          await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [migration.name, migration.checksum]);
          await client.query("COMMIT");
          console.log(`Applied ${migration.name}`);
          count += 1;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
      console.log(count === 0 ? "Database is up to date." : `Applied ${count} migration(s).`);
    } finally {
      await client.query("SELECT pg_advisory_unlock(742928314)");
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
