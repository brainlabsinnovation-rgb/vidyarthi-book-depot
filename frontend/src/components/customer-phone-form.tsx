"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authRequest, verifiedUser } from "@/lib/customer-auth";
import { useCustomerAuth } from "./customer-auth-provider";

export function CustomerPhoneForm({ mode, nextPath, available, recovery = false }: { mode: "login" | "signup"; nextPath: string; available: boolean; recovery?: boolean }) {
  const router = useRouter(); const { refresh } = useCustomerAuth();
  const [phone, setPhone] = useState(""); const [challenge, setChallenge] = useState("");
  const [purpose, setPurpose] = useState<"signup" | "login" | "reset">(recovery ? "reset" : mode === "signup" ? "signup" : "login");
  const [useCode, setUseCode] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  // Signup resends use a fresh start so the password never lives in React state.
  const [canResend, setCanResend] = useState(false);
  async function finish() {
    const session = await refresh();
    if (!verifiedUser(session?.user || null)) throw new Error("Verify your number before continuing.");
    router.replace(nextPath); router.refresh();
  }
  async function start() {
    const result = await authRequest<{ challenge: string }>("phone/start", { phoneNumber: phone, purpose });
    setChallenge(result.challenge);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      if (challenge) {
        if (purpose === "reset") {
          if (form.get("password") !== form.get("confirm")) throw new Error("The passwords do not match.");
          await authRequest("phone/reset-password", { challenge, code: form.get("code"), password: form.get("password") });
          await refresh(); setChallenge(""); setPurpose("login"); setUseCode(false); setNotice("Password updated. Sign in with your new password."); return;
        }
        await authRequest("phone/verify", { challenge, code: form.get("code") }); await finish(); return;
      }
      if (purpose === "login" && !useCode) {
        await authRequest("phone/sign-in/password", { phoneNumber: phone, password: form.get("password") }); await finish(); return;
      }
      if (purpose === "signup") {
        if (form.get("password") !== form.get("confirm")) throw new Error("The passwords do not match.");
        const result = await authRequest<{ challenge: string }>("phone/start", { phoneNumber: phone, purpose, name: form.get("name"), password: form.get("password") });
        setChallenge(result.challenge); setCanResend(false);
      } else { await start(); setCanResend(true); }
      setNotice("If eligible, a code has been sent. It expires in 5 minutes.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Please try again."); } finally { setBusy(false); }
  }
  async function resend() {
    setBusy(true); setError("");
    try { await start(); setNotice("If eligible, a new code has been sent. Use the latest code."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Please try again."); } finally { setBusy(false); }
  }
  const needsSMS = Boolean(challenge || purpose !== "login" || useCode);
  return <div className="auth-phone-form">
    {!available && <p className="auth-notice">SMS verification is temporarily unavailable. Existing verified accounts can still use their password.</p>}
    <form onSubmit={submit}>
      {challenge ? <><p>Enter the code sent to {phone}.</p><label>Verification code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus /></label>
        {purpose === "reset" && <><label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label><label>Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label></>}
      </> : <>
        {purpose === "signup" && <label>Full name<input name="name" autoComplete="name" maxLength={120} required/></label>}
        <label>Mobile number<div className="auth-phone-input"><span>+91</span><input type="tel" autoComplete="tel-national" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} required value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g,""))} placeholder="10-digit mobile number"/></div></label>
        {(purpose === "signup" || (purpose === "login" && !useCode)) && <label>Password<input name="password" type="password" autoComplete={purpose === "signup" ? "new-password" : "current-password"} minLength={purpose === "signup" ? 12 : undefined} maxLength={128} required/></label>}
        {purpose === "signup" && <><label>Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label><label className="auth-consent"><input type="checkbox" required/><span>I agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</span></label></>}
      </>}
      {error && <p className="auth-error" role="alert">{error}</p>}{notice && <p className="auth-notice" role="status">{notice}</p>}
      <button className="button primary" disabled={busy || (needsSMS && !available)}>{busy ? "Please wait…" : challenge ? purpose === "reset" ? "Reset password" : "Verify and continue" : purpose === "signup" ? "Create account" : purpose === "reset" || useCode ? "Send verification code" : "Sign in"}</button>
    </form>
    <div className="auth-bottom">{challenge ? <>{canResend && <button disabled={busy} onClick={resend}>Resend code</button>}<button disabled={busy} onClick={() => { setChallenge(""); setError(""); setNotice(""); }}>Start again</button></> : purpose === "login" ? <><button disabled={busy} onClick={() => { setUseCode((v) => !v); setError(""); }}>{useCode ? "Use my password" : "Use a verification code"}</button><button disabled={busy} onClick={() => { setPurpose("reset"); setError(""); }}>Forgot password?</button></> : purpose === "reset" ? <button onClick={() => setPurpose("login")}>Return to sign in</button> : null}</div>
    <p className="auth-switch">{mode === "signup" ? "Already have an account?" : "New to Vidyarthi?"} <Link href={`${mode === "signup" ? "/account" : "/register"}?next=${encodeURIComponent(nextPath)}`}>{mode === "signup" ? "Sign in" : "Create an account"}</Link></p>
  </div>;
}
