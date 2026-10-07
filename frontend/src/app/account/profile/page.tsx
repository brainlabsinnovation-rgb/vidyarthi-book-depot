"use client";
import { FormEvent, useState } from "react";
import { AccountShell } from "@/components/account-shell";
import { useCustomerAuth } from "@/components/customer-auth-provider";
import { authRequest } from "@/lib/customer-auth";
import Link from "next/link";
export default function Profile() {
  const { user, refresh } = useCustomerAuth(); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [error,setError]=useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      await authRequest("update-user", { name: String(new FormData(event.currentTarget).get("name") || "").trim() });
      await refresh(); setMessage("Your profile has been updated.");
    } catch(reason) { setError(reason instanceof Error ? reason.message : "Could not update your profile."); } finally { setBusy(false); }
  }
  return <AccountShell title="Profile" intro="Your verified account details." nextPath="/account/profile"><form className="account-panel account-form" onSubmit={submit}><div className="form-grid"><label className="full">Full name<input name="name" key={user?.id} defaultValue={user?.name} maxLength={120} required/></label><label>Email address<input readOnly value={user?.emailVerified ? user.email : ""} placeholder="No verified email"/></label><label>Mobile number<input readOnly value={user?.phoneNumberVerified ? user.phoneNumber : ""} placeholder="No verified mobile number"/></label></div>{error && <p className="auth-error" role="alert">{error}</p>}{message && <p className="auth-notice" role="status">{message}</p>}<button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button></form><section className="account-panel"><h2>Password</h2><p>Use a verification code to reset your password.</p><div className="account-actions"><Link className="button secondary" href="/forgot-password">Reset email password</Link><Link className="button secondary" href="/forgot-password?method=phone">Phone account recovery</Link></div></section></AccountShell>;
}
