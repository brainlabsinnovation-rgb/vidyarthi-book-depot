import { fork, spawn } from "node:child_process";
import { createServer } from "node:net";
import { randomUUID, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { promises as fs, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const req = createRequire(join(root, "backend/package.json"));
const pg = req("pg");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const work = join(tmpdir(), "vidyarthi-auth-audit-" + stamp);
const output = resolve(root, process.env.AUTH_AUDIT_OUTPUT || "artifacts/auth-audit", stamp);
const postgresBin = process.env.POSTGRES_BIN || "C:/Program Files/PostgreSQL/18/bin";
const binary = (name) => join(postgresBin, name + (process.platform === "win32" ? ".exe" : ""));
const children = [];
let clusterRunning = false;
let database;
let stopping = false;
const privateControl = join(work, "private-ui-control.json");
await fs.mkdir(work, { recursive: true });
await fs.mkdir(output, { recursive: true });

async function command(executable, args, options = {}) {
  const child = spawn(executable, args, { cwd: root, windowsHide: true, ...options });
  let text = "";
  child.stdout?.on("data", (chunk) => { text += chunk; });
  child.stderr?.on("data", (chunk) => { text += chunk; });
  const code = await new Promise((resolve, reject) => { child.on("error", reject); child.on("exit", resolve); });
  if (code !== 0) throw new Error(`Audit command ${executable.split(/[\\/]/).pop()} failed with exit ${code}`);
  return text;
}
async function port() {
  const listener = createServer();
  await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
  const value = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return value;
}
async function ready(url, child) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("An isolated application process exited before readiness");
    try { if ((await fetch(url, { signal: AbortSignal.timeout(3000) })).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Isolated application readiness timed out");
}
async function cleanup() {
  if (stopping) return;
  stopping = true;
  for (const child of [...children].reverse()) {
    if (child.exitCode !== null) continue;
    if (process.platform === "win32") await command("taskkill", ["/PID", String(child.pid), "/T", "/F"]).catch(() => {});
    else child.kill("SIGTERM");
  }
  await database?.end().catch(() => {});
  if (clusterRunning) await command(binary("pg_ctl"), ["stop", "-D", join(work, "data"), "-m", "fast", "-w"]).catch(() => {});
  await fs.writeFile(join(output, "cleanup.json"), JSON.stringify({ completedAt: new Date().toISOString(), isolatedProcessesStopped: true,
    neonMutated: false, note: "Local test data retained in the private temporary cluster; its server is stopped." }, null, 2));
}
process.on("SIGINT", () => { void cleanup().then(() => process.exit(0)); });
process.on("SIGTERM", () => { void cleanup().then(() => process.exit(0)); });

try {
  const [databasePort, backendPort, frontendPort] = await Promise.all([port(), port(), port()]);
  const databaseURL = `postgresql://auth_audit@127.0.0.1:${databasePort}/auth_audit`;
  // Cookies are scoped by host, not port. Use a different loopback host from
  // the user's localhost site so browser tests cannot overwrite its cookies.
  const origin = `http://127.0.0.1:${frontendPort}`;
  const backendURL = `http://127.0.0.1:${backendPort}`;
  await command(binary("initdb"), ["-D", join(work, "data"), "-U", "auth_audit", "-A", "trust", "--encoding=UTF8", "--no-locale"]);
  await command(binary("pg_ctl"), ["start", "-D", join(work, "data"), "-l", join(work, "postgres.log"), "-o", `-p ${databasePort} -h 127.0.0.1`, "-w"]);
  clusterRunning = true;
  await command(binary("createdb"), ["-h", "127.0.0.1", "-p", String(databasePort), "-U", "auth_audit", "auth_audit"]);
  const env = { ...process.env, NODE_ENV: "test", DATABASE_URL: databaseURL, BETTER_AUTH_SECRET: "isolated-audit-" + randomUUID(),
    PORT: String(backendPort), FRONTEND_ORIGIN: origin, BETTER_AUTH_URL: origin,
    BREVO_API_KEY: "isolated-test-not-a-real-key", AUTH_EMAIL_FROM: "sender@example.com",
    GOOGLE_CLIENT_ID: "isolated-google", GOOGLE_CLIENT_SECRET: "isolated-not-a-secret",
    FACEBOOK_CLIENT_ID: "isolated-facebook", FACEBOOK_CLIENT_SECRET: "isolated-not-a-secret",
    TWILIO_ACCOUNT_SID: "isolated-sms", TWILIO_AUTH_TOKEN: "isolated-not-a-secret", TWILIO_FROM_NUMBER: "+919999999999" };
  const migrationLog = await command(process.execPath, ["database/scripts/migrate.mjs"], { cwd: join(root, "backend"), env });
  const seedLog = await command(process.execPath, ["database/scripts/seed-samples.mjs"], { cwd: join(root, "backend"), env: { ...env, SAMPLE_SEED_CONFIRM: "yes" } });
  await fs.writeFile(join(output, "setup.log"), migrationLog + seedLog);
  database = new pg.Pool({ connectionString: databaseURL, max: 5 });
  const codes = new Map(); const deliveries = [];
  const control = { origin, backendURL, output };
  let deliveryStatus;
  const backend = fork(join(root, "backend/src/server.mjs"), [], { cwd: join(root, "backend"), env,
    execArgv: ["--import", pathToFileURL(join(root, "backend/tests/helpers/capture-delivery.mjs")).href],
    stdio: ["ignore", "pipe", "pipe", "ipc"], windowsHide: true });
  children.push(backend);
  const backendLogs = [];
  backend.stdout.on("data", (chunk) => backendLogs.push(String(chunk)));
  backend.stderr.on("data", (chunk) => backendLogs.push(String(chunk)));
  backend.on("message", (message) => {
    if (message.type === "delivery-status-ready") deliveryStatus = message.status;
    if (message.type === "captured-delivery") {
      if (message.status < 400) codes.set(message.channel === "phone" ? message.recipient : message.purpose + ":" + message.recipient, message.otp);
      deliveries.push({ ...message, capturedAt: new Date().toISOString() });
      writeFileSync(privateControl, JSON.stringify({ ...control, codes: Object.fromEntries(codes) }));
    }
  });
  await ready(backendURL + "/api/ready", backend);
  const { runAudit } = await import("../backend/tests/auth-audit.mjs");
  const evidence = await runAudit({ database, backendURL, origin, codes, deliveries, secret: env.BETTER_AUTH_SECRET,
    async setDeliveryStatus(status) {
      deliveryStatus = null; backend.send({ type: "delivery-status", status });
      const deadline = Date.now() + 3000;
      while (deliveryStatus !== status && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
      if (deliveryStatus !== status) throw new Error("Capture adapter did not acknowledge status");
    } });
  const sourceHashes = {};
  for (const file of ["backend/src/auth-config.mjs", "backend/src/auth-phone.mjs", "backend/src/auth-delivery.mjs", "backend/src/customer-account.mjs",
    "backend/src/password-security.mjs", "backend/src/server.mjs", "backend/tests/auth-audit.mjs", "scripts/auth-audit.mjs",
    "frontend/src/components/customer-auth-form.tsx", "frontend/src/components/customer-password-reset.tsx", "frontend/src/lib/customer-auth.ts", "frontend/next.config.ts"]) {
    sourceHashes[file] = createHash("sha256").update(await fs.readFile(join(root, file))).digest("hex");
  }
  await fs.writeFile(join(output, "results.json"), JSON.stringify({ ...evidence, sourceHashes,
    environment: { node: process.version, database: "PostgreSQL local disposable auth_audit", backendURL, origin, realDelivery: false,
      expiryMethod: "Expiry timestamps moved into the past only in the isolated test database", source: "actual backend/src/server.mjs over HTTP" } }, null, 2));
  await fs.writeFile(join(output, "backend.log"), backendLogs.join(""));
  console.log(JSON.stringify({ stage: "api-audit-complete", output, counts: evidence.counts, origin, backendURL, privateControl }));
  const regressionLog = await command(process.execPath, ["--test", "tests/customer-auth.test.mjs"], {
    cwd: join(root, "backend"), env: { ...env, AUTH_TEST_DATABASE_URL: databaseURL },
  });
  await fs.writeFile(join(output, "regression.tap"), regressionLog);
  await fs.writeFile(join(output, "regression-summary.json"), JSON.stringify({
    tests: Number(regressionLog.match(/# tests (\d+)/)?.[1]), passed: Number(regressionLog.match(/# pass (\d+)/)?.[1]),
    failed: Number(regressionLog.match(/# fail (\d+)/)?.[1]), skipped: Number(regressionLog.match(/# skipped (\d+)/)?.[1]),
    database: "same isolated local test database", realProviderDelivery: false,
  }, null, 2));
  if (process.argv.includes("--live")) {
    const { runLiveChecks } = await import("../backend/tests/auth-live-checks.mjs");
    await fs.writeFile(join(output, "live-checks.json"), JSON.stringify(await runLiveChecks(), null, 2));
  }

  if (process.argv.includes("--serve-ui")) {
    const frontend = join(work, "frontend"); await fs.mkdir(frontend);
    for (const directory of ["src", "public"]) await fs.cp(join(root, "frontend", directory), join(frontend, directory), { recursive: true });
    for (const file of ["package.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs", "next-env.d.ts"]) {
      await fs.copyFile(join(root, "frontend", file), join(frontend, file));
    }
    const isolatedConfig = await fs.readFile(join(frontend, "next.config.ts"), "utf8");
    await fs.writeFile(join(frontend, "next.config.ts"), isolatedConfig.replace("const nextConfig: NextConfig = {", "const nextConfig: NextConfig = {\n  allowedDevOrigins: ['127.0.0.1'],"));
    await fs.symlink(join(root, "frontend/node_modules"), join(frontend, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    const frontendChild = spawn(process.execPath, [join(root, "frontend/node_modules/next/dist/bin/next"), "dev", frontend, "--webpack", "--port", String(frontendPort)],
      { env: { ...process.env, NODE_ENV: "development", BACKEND_URL: backendURL, NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    children.push(frontendChild);
    const frontendLogs = [];
    frontendChild.stdout.on("data", (chunk) => frontendLogs.push(String(chunk)));
    frontendChild.stderr.on("data", (chunk) => frontendLogs.push(String(chunk)));
    await ready(origin + "/account", frontendChild);
    // Use API-created disposable accounts for browser checks. No real provider mail is sent.
    const uiEmail = "ui-audit@example.com"; const uiPassword = "Isolated browser test password 2026!";
    const request = async (path, body) => fetch(backendURL + "/api/auth/" + path, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!(await request("sign-up/email", { email: uiEmail, name: "Browser Audit", password: uiPassword })).ok) throw new Error("UI fixture signup failed");
    const uiCode = codes.get("email-verification:" + uiEmail);
    if (!(await request("email-otp/verify-email", { email: uiEmail, otp: uiCode })).ok) throw new Error("UI fixture verification failed");
    Object.assign(control, { uiEmail, uiPassword });
    await fs.writeFile(privateControl, JSON.stringify({ ...control, codes: Object.fromEntries(codes) }));
    console.log(JSON.stringify({ stage: "browser-ready", origin, output, privateControl, stopFile: join(work, "STOP") }));
    while (true) {
      try { await fs.access(join(work, "STOP")); break; } catch {}
      if (frontendChild.exitCode !== null || backend.exitCode !== null) throw new Error("Isolated UI process stopped unexpectedly");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    await fs.writeFile(join(output, "frontend.log"), frontendLogs.join(""));
  }
  process.exitCode = evidence.counts.failed ? 1 : 0;
} catch (error) {
  await fs.writeFile(join(output, "runner-error.json"), JSON.stringify({ error: error.message, at: new Date().toISOString() }, null, 2));
  console.error("Authentication audit runner failed: " + error.message);
  process.exitCode = 1;
} finally {
  await cleanup();
  const { writeAuthReport } = await import('./auth-audit-report.mjs');
  await writeAuthReport(output);
}
