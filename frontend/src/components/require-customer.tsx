"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "./customer-auth-provider";
import { verifiedUser } from "@/lib/customer-auth";
export function RequireCustomer({ children, nextPath }: { children: React.ReactNode; nextPath: string }) {
  const { user, status } = useCustomerAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === "signed-out" || (status === "signed-in" && !verifiedUser(user)))
      router.replace(`/account?next=${encodeURIComponent(nextPath)}`);
  }, [status, user, nextPath, router]);
  if (status === "unavailable") return <section className="section"><div className="shell empty-state"><h1>We could not check your account.</h1><p>Please refresh the page and try again.</p></div></section>;
  if (status !== "signed-in" || !verifiedUser(user)) return <section className="section"><div className="shell"><p role="status">Checking your account…</p></div></section>;
  return <>{children}</>;
}
