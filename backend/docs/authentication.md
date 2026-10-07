# Customer authentication
Customers can browse and keep a browser-local cart before signing in. Cart checkout sends guests to `/account?next=/checkout`. Only a server-verified email or phone identity can reach checkout preparation and customer APIs.

## Provider configuration
Set these values only in the Git-ignored `backend/.env`:
- `BREVO_API_KEY`: Brevo transactional API key.
- `AUTH_EMAIL_FROM`: a sender verified in Brevo.
- `AUTH_EMAIL_FROM_NAME`: sender display name.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: Google web OAuth client.
- `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET`: Meta/Facebook app.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`: an SMS-capable, approved sender. Indian SMS delivery requires the provider's applicable sender/template registration and recipient permissions; test a real opted-in number before enabling production.
- `BETTER_AUTH_URL`: public storefront origin, locally `http://localhost:3000`.
- `FRONTEND_ORIGIN`: same storefront origin.

OAuth callbacks are `http://localhost:3000/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/facebook`; register equivalent HTTPS URLs for production. Add the public frontend origin to the Google client. Configure Facebook app permissions and live access before public use. Unconfigured providers show as unavailable and never bypass verification.

## Implemented flows
Email signup creates an unverified account with a salted scrypt password hash. Brevo delivers a six-digit code. A valid code verifies the email and creates an HttpOnly session. Verified customers can use their password or an email sign-in code. Resetting a password requires a code and revokes sessions.
Signup rejects an already registered email with `SIGNUP_ACCOUNT_ALREADY_EXISTS` (HTTP 409), including unverified accounts and differences in casing or surrounding spaces. The frontend stays on the signup form and directs the customer to sign in. No signup code is sent and existing account details are unchanged.
Forgot password checks that the email belongs to an existing user before sending a reset code. Unknown emails receive `RESET_ACCOUNT_NOT_FOUND`; the frontend remains on the email-entry form and offers a signup link. This deliberately reveals whether the email is registered. Email OTP sign-in retains its generic response for unknown accounts.
Phone signup verifies a six-digit SMS challenge before creating an account. A verified phone can use password or OTP login. SMS reset revokes sessions. A private synthetic email is used only as the auth library's internal identifier for phone-only accounts; it is never treated as a verified email.
Google and Facebook use Better Auth OAuth handling, with state protection and encrypted provider tokens. Automatic linking by matching email is disabled; existing accounts must use their original method until explicit account linking is added.

## Staying signed in
Website login uses a persistent HttpOnly session cookie for password and OTP methods. Sessions last seven days and refresh when used after the one-day update interval. The frontend requests remembered email/password login explicitly. Closing a regular browser window does not remove this cookie; clearing site data, private browsing, browser cookie policies, expiry, sign-out and password reset can end access. Provider tokens in the account table remain separate from website sessions.

## Security controls
New passwords use Node scrypt with N=131072, r=8, p=1, a random 32-byte salt and 64-byte output; verification uses a constant-time comparison. Legacy Better Auth hashes remain readable. Minimum password length is 12, maximum 128 characters. Password hash work is bounded to two concurrent operations.
Email OTPs use HMAC hashes; phone OTPs are HMAC-bound to a random challenge. Both expire after 5 minutes; valid codes are consumed once. Each code permits five incorrect verification guesses before a new code is required. Authentication request throttling and resend countdowns are disabled: signup, password login, code sending and password-reset requests have no application-enforced frequency limits. The existing rate-limit tables are retained for migration compatibility but are no longer used by authentication. Password hashing retains its bounded work queue to protect server memory. Session cookies are HttpOnly, SameSite=Lax and Secure with an HTTPS public URL. Customer routes check current server sessions, verification, ownership and mutation origins. Customer signup cannot assign admin roles.
Names and verified contact details are stored as normal data because the store needs to use them; passwords are hashed. TLS, database access controls and secret handling also remain required. No security design makes password guessing impossible.
Origin and CSRF checks are explicitly enabled in all environments, including automated tests. Required verification-delivery tasks propagate provider failures to the API instead of swallowing them as background-task errors.

## Automated audit with evidence
From the project root, run `npm run test:auth`. The runner creates its own temporary local PostgreSQL cluster, applies migrations, seeds sample products and runs the actual backend over HTTP. It captures Brevo/Twilio requests with a test-only preload; production does not import that capture module. PostgreSQL binaries default to `C:/Program Files/PostgreSQL/18/bin`; set `POSTGRES_BIN` when installed elsewhere. The runner stops its backend and database and writes redacted JSON evidence under `artifacts/auth-audit/<timestamp>/`.
`node scripts/auth-audit.mjs --serve-ui` also creates an isolated copy of the frontend for browser validation. It prints a local browser URL and a stop-file path. Create that stop file to stop the isolated frontend/backend/database after browser checks. The private temporary control file contains only disposable test credentials/codes; do not include it in shared evidence. Expiry tests move timestamps in the local database. Real provider inbox/SMS delivery, OAuth consent and an actual browser restart are separate checks.
Each completed audit writes `report.md`, `report.html`, grouped `case-evidence.json` and a SHA-256 `manifest.json`. The report preserves failed outcomes and clearly separates API/database tests, regression tests, optional live checks and any browser results. `npm run test:auth -- --live` adds read-only checks of the running local website/backend and the known Neon development database. The isolated browser host is `127.0.0.1` to avoid overwriting the user's `localhost` cookies; its Next.js dev-origin allowance exists only in the temporary test copy.

## Validation
Run `node --test tests/customer-auth.test.mjs` for local security checks. For integration checks, set `AUTH_TEST_DATABASE_URL` to a disposable local PostgreSQL database with all migrations applied, then run the same command. Integration tests capture OTPs inside their injected delivery adapters; no test-code delivery or bypass exists in the running application.
Real Brevo inbox delivery, Google/Facebook consent, and SMS delivery require actual provider credentials and separate live tests. Order placement remains disabled until payment and fulfilment setup.
