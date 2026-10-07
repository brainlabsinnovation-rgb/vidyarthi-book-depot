# Vidhyarthi backend database foundation

This folder owns the PostgreSQL schema, migrations, catalog and admin APIs, cart quotes, and authentication.

From the project root, run `npm run dev` to start both the storefront and backend. The backend runs at `http://localhost:4000`. `GET /api/health` confirms the HTTP process is running; `GET /api/ready` checks the PostgreSQL connection and returns 503 until `DATABASE_URL` is configured. The root command installs missing dependencies from the existing pnpm lockfiles on its first run.

## Setup

1. Create a **development** PostgreSQL database or Neon branch. Neon creates the database in its console; these scripts create its tables.
2. Run `pnpm install` inside this folder.
3. Copy `.env.example` to `.env` and replace `DATABASE_URL` with that database's connection string. Keep `.env` private.
4. Run `pnpm db:status` to inspect pending migrations.
5. Run `pnpm db:migrate` to apply them.

Each migration is transactional, ordered by filename, and checked against its recorded checksum. Run the same command against a new PostgreSQL provider to reproduce the schema. Never point it at a production database without reviewing pending SQL and taking a backup first.

In PowerShell, run `$env:SAMPLE_SEED_CONFIRM='yes'; pnpm db:seed:sample; Remove-Item Env:SAMPLE_SEED_CONFIRM` to add the 16 marked sample products on a development database. The seed does not overwrite existing records. Customer registration uses verified email or phone ownership (see [authentication setup](docs/authentication.md)). Public admin registration is disabled; create a user through a controlled setup step and assign its `admin` role with Better Auth's admin API.

With no `DATABASE_URL`, public catalog and quote routes use sample data, while admin and authentication routes return 503. `.env.example` also lists Neon object storage and Razorpay test credentials; media upload, payment, and real order submission require those services and fulfilment rules. Do not put service secrets in frontend variables.

See [database/schema/README.md](database/schema/README.md) for the data model. No Neon credentials are included in this repository.
