import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { verifyPassword as verifyLegacyPassword } from "better-auth/crypto";
import { APIError } from "better-auth/api";

const scrypt = promisify(scryptCallback);
const params = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
let running = 0;
const queue = [];
async function withHashSlot(action) {
  if (running >= 2) {
    if (queue.length >= 16) throw new APIError("TOO_MANY_REQUESTS", { message: "Please try again shortly." });
    await new Promise((resolve) => queue.push(resolve));
  } else running += 1;
  try { return await action(); }
  finally { const next = queue.shift(); if (next) next(); else running -= 1; }
}
export function validatePassword(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 128)
    throw new APIError("BAD_REQUEST", { message: "Use a password between 12 and 128 characters." });
}
export async function hashPassword(password) {
  validatePassword(password);
  return withHashSlot(async () => {
    const salt = randomBytes(32);
    const hash = await scrypt(password, salt, 64, params);
    return ["", "scrypt", params.N, params.r, params.p, salt.toString("hex"), hash.toString("hex")].join("$");
  });
}
export async function verifyPassword({ hash, password }) {
  if (typeof password !== "string" || password.length > 128 || typeof hash !== "string") return false;
  if (!hash.startsWith("$scrypt$")) return verifyLegacyPassword({ hash, password });
  const parts = hash.split("$");
  if (parts.length !== 7 || parts[2] !== "131072" || parts[3] !== "8" || parts[4] !== "1" ||
      !/^[a-f0-9]{64}$/.test(parts[5]) || !/^[a-f0-9]{128}$/.test(parts[6])) return false;
  return withHashSlot(async () => {
    const actual = await scrypt(password, Buffer.from(parts[5], "hex"), 64, params);
    return timingSafeEqual(actual, Buffer.from(parts[6], "hex"));
  });
}
