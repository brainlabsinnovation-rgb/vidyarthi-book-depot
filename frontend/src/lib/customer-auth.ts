export type CustomerUser = { id: string; name: string; email: string; emailVerified: boolean; phoneNumber?: string; phoneNumberVerified?: boolean; role?: string };
export type CustomerSession = { user: CustomerUser; session: { expiresAt: string } };
export type AuthMethods = { emailPassword: boolean; email: boolean; google: boolean; facebook: boolean; phone: boolean };
export class AuthRequestError extends Error {
  constructor(message: string, public code: string, public status: number) { super(message); }
}
export async function authRequest<T = Record<string, unknown>>(path: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`/api/auth/${path}`, { method: body ? "POST" : "GET", credentials: "include", cache: "no-store",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.code === "TOO_MANY_ATTEMPTS" ? "This code is no longer valid. Request a new code to continue."
      : response.status === 429 ? "Sign-in is temporarily busy. Please try again shortly."
      : typeof data.message === "string" ? data.message : "We could not complete that request. Please try again.";
    throw new AuthRequestError(message, String(data.code || ""), response.status);
  }
  return data as T;
}
export function verifiedUser(user: CustomerUser | null) { return Boolean(user?.emailVerified || user?.phoneNumberVerified); }
export function safeReturnPath(value: unknown) {
  if (typeof value !== "string" || /[\\\r\n]/.test(value)) return "/account/dashboard";
  return /^\/(checkout|cart|wishlist|orders|account\/dashboard|account\/profile|account\/addresses)(?:[/?#]|$)/.test(value) ? value : "/account/dashboard";
}
