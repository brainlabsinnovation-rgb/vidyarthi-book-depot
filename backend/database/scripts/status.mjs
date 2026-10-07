import { appliedMigrations, createDatabaseClient, ensureMigrationTable, loadMigrations, verifyHistory } from "./shared.mjs";

async function main() {
  const migrations = await loadMigrations();
  const client = createDatabaseClient();
  await client.connect();
  try {
    await ensureMigrationTable(client);
    const applied = await appliedMigrations(client);
    verifyHistory(migrations, applied);
    for (const migration of migrations) console.log(`${applied.has(migration.name) ? "applied" : "pending"} ${migration.name}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
