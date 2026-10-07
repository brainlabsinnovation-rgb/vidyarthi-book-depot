-- Append-only authentication additions. Existing migrations remain unchanged.
ALTER TABLE "user" ADD COLUMN "phoneNumber" text;
ALTER TABLE "user" ADD COLUMN "phoneNumberVerified" boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX user_phone_number_unique ON "user" ("phoneNumber") WHERE "phoneNumber" IS NOT NULL;
ALTER TABLE customers ADD COLUMN auth_user_id text UNIQUE REFERENCES "user"(id) ON DELETE CASCADE;

CREATE TABLE "rateLimit" (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  count integer NOT NULL,
  "lastRequest" bigint NOT NULL
);
CREATE TABLE auth_contact_limits (
  key text PRIMARY KEY,
  count integer NOT NULL CHECK (count > 0),
  last_request timestamptz NOT NULL
);
CREATE TABLE phone_auth_challenges (
  id text PRIMARY KEY,
  phone text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('signup','login','reset')),
  user_id text REFERENCES "user"(id) ON DELETE CASCADE,
  full_name text,
  password_hash text,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX phone_auth_challenges_expiry_idx ON phone_auth_challenges(expires_at);
