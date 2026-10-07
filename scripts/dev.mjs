import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const isWindows = process.platform === "win32";
const apps = [
  { name: "frontend", requiredPackage: "next" },
  { name: "backend", requiredPackage: "pg" },
];

for (const app of apps) {
  if (existsSync(join(root, app.name, "node_modules", app.requiredPackage))) continue;
  console.log(`Installing ${app.name} dependencies...`);
  const install = spawnSync("pnpm", ["--dir", app.name, "install", "--frozen-lockfile"], {
    cwd: root,
    stdio: "inherit",
    shell: isWindows,
  });
  if (install.error) throw install.error;
  if (install.status !== 0) process.exit(install.status ?? 1);
}

const children = apps.map((app) => {
  console.log(`Starting ${app.name}...`);
  const child = spawn("pnpm", ["--dir", app.name, "dev"], {
    cwd: root,
    stdio: "inherit",
    shell: isWindows,
  });
  child.on("error", (error) => {
    console.error(`${app.name} could not start:`, error);
    stopAll(1);
  });
  return child;
});

let stopping = false;
function stopAll(exitCode) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (isWindows) {
      // Stop only the process tree created by this command.
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  }
  process.exitCode = exitCode;
}

for (const [index, child] of children.entries()) {
  child.on("exit", (code, signal) => {
    if (stopping) return;
    console.error(`${apps[index].name} stopped (${signal ?? `exit ${code ?? "unknown"}`}). Stopping both apps.`);
    stopAll(code ?? 1);
  });
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
