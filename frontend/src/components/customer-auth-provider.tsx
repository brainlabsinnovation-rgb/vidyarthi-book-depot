"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authRequest, CustomerSession, CustomerUser } from "@/lib/customer-auth";

type AuthContextValue = { user: CustomerUser | null; status: "checking" | "signed-in" | "signed-out" | "unavailable"; refresh: () => Promise<CustomerSession | null>; signOut: () => Promise<void> };
const Context = createContext<AuthContextValue | null>(null);
export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("checking");
  const refresh = useCallback(async () => {
    try {
      const session = await authRequest<CustomerSession | null>("get-session");
      setUser(session?.user || null); setStatus(session?.user ? "signed-in" : "signed-out");
      return session;
    } catch { setUser(null); setStatus("unavailable"); return null; }
  }, []);
  useEffect(() => {
    let active = true;
    authRequest<CustomerSession | null>("get-session").then((session) => {
      if (active) { setUser(session?.user || null); setStatus(session?.user ? "signed-in" : "signed-out"); }
    }).catch(() => { if (active) setStatus("unavailable"); });
    const focus = () => { void refresh(); };
    window.addEventListener("focus", focus);
    return () => { active = false; window.removeEventListener("focus", focus); };
  }, [refresh]);
  const signOut = async () => { await authRequest("sign-out", {}); setUser(null); setStatus("signed-out"); };
  return <Context.Provider value={{ user, status, refresh, signOut }}>{children}</Context.Provider>;
}
export function useCustomerAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("CustomerAuthProvider is required");
  return value;
}
