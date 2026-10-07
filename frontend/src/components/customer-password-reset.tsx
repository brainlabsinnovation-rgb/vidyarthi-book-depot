"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { Mail } from "lucide-react";
import { authRequest, AuthRequestError, safeReturnPath } from "@/lib/customer-auth";
import { useCustomerAuth } from "./customer-auth-provider";
export function CustomerPasswordReset({ nextPath }: { nextPath: string }) {
  const { refresh } = useCustomerAuth();
  const [stage, setStage] = useState<"email" | "reset" | "done">("email");
  const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [accountMissing, setAccountMissing] = useState(false);
  async function send() {
    const address = email.trim().toLowerCase();
    await authRequest("email-otp/request-password-reset", { email: address });
    setEmail(address); setStage("reset");
  }
  function showError(reason: unknown) {
    const missing = reason instanceof AuthRequestError && reason.code === "RESET_ACCOUNT_NOT_FOUND";
    setAccountMissing(missing);
    if (missing) setStage("email");
    setError(reason instanceof Error ? reason.message : "Please try again.");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setAccountMissing(false); setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      if (stage === "email") await send();
      else {
        if (data.get("password") !== data.get("confirm")) throw new Error("The passwords do not match.");
        await authRequest("email-otp/reset-password", { email: email.trim().toLowerCase(), otp: data.get("otp"), password: data.get("password") });
        await refresh(); setStage("done");
      }
    } catch (reason) { showError(reason); } finally { setBusy(false); }
  }
  async function resend() { setBusy(true); setError(""); setAccountMissing(false); try { await send(); } catch (reason) { showError(reason); } finally { setBusy(false); } }
  return <section className="section customer-auth-section"><div className="shell"><div className="auth-card auth-reset-card"><span className="auth-card-icon"><Mail/></span><h1>{stage === "done" ? "Password updated" : "Reset your password"}</h1>
    <p>{stage === "email" ? "Enter your registered email address." : stage === "reset" ? `A reset code has been sent to ${email}. It expires in 5 minutes.` : "Sign in with your new password. Your previous sessions have been signed out."}</p>
    {stage !== "done" && <form onSubmit={submit}>{stage === "email" ? <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(e) => { setEmail(e.target.value); setError(""); setAccountMissing(false); }} /></label> : <>
      <label>Verification code<input name="otp" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /></label>
      <label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
      <label>Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
    </>}{error && <p role="alert" className="auth-error">{error}</p>}<button className="button primary" disabled={busy}>{busy ? "Please wait…" : stage === "email" ? "Send reset code" : "Reset password"}</button></form>}
    {accountMissing && <p className="auth-switch">New to Vidyarthi? <Link href={`/register?next=${encodeURIComponent(safeReturnPath(nextPath))}`}>Create an account</Link></p>}
    {stage === "reset" && <div className="auth-bottom"><button disabled={busy} onClick={resend}>Resend code</button><button disabled={busy} onClick={() => { setStage("email"); setError(""); }}>Change email</button></div>}
    <Link className="auth-back-link" href={`/account?next=${encodeURIComponent(safeReturnPath(nextPath))}`}>Return to sign in</Link>
  </div></div></section>;
}
