"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { Brand } from "@/components/brand";

export default function AdminLogin() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/store/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
        credentials: "include",
      });
      if (!response.ok) {
        setError(response.status === 503 ? "Admin login is waiting for the database connection." : "The email or password could not be verified.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Admin login is unavailable. Please try again.");
    } finally { setBusy(false); }
  }

  return <section className="admin-login"><div className="admin-login-card"><Brand/><span className="account-icon"><LockKeyhole/></span><h1>Store administration</h1><p>Sign in to manage products, categories, orders, inventory and offers.</p><form onSubmit={submit}><label>Email address<input name="email" type="email" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p className="demo-note" role="alert">{error}</p>}<button className="button primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form><Link className="back-store" href="/">← Return to storefront</Link></div></section>;
}
