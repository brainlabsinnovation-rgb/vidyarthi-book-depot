"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, ShoppingBag } from "lucide-react";
import { CustomerPhoneForm } from "./customer-phone-form";
import { useCustomerAuth } from "./customer-auth-provider";
import { AuthMethods, authRequest, AuthRequestError, safeReturnPath, verifiedUser } from "@/lib/customer-auth";

type Stage = "details" | "verify" | "email-code";
export function CustomerAuthForm({ mode, nextPath }: { mode: "login" | "signup"; nextPath: string }) {
  const router = useRouter(); const { user, status, refresh } = useCustomerAuth();
  const destination = safeReturnPath(nextPath);
  const [methods, setMethods] = useState<AuthMethods | null>(null);
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [stage, setStage] = useState<Stage>("details");
  const [useCode, setUseCode] = useState(false);
  const [email, setEmail] = useState(""); const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/store/auth-config", { signal: controller.signal }).then((r) => r.ok ? r.json() : Promise.reject())
      .then(setMethods).catch(() => { if (!controller.signal.aborted) setError("Sign-in is temporarily unavailable. Please try again."); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (status === "signed-in" && verifiedUser(user)) router.replace(destination);
  }, [status, user, destination, router]);

  async function finish() {
    const session = await refresh();
    if (!session?.user || !verifiedUser(session.user)) throw new Error("Your account needs verification before you can continue.");
    router.replace(destination); router.refresh();
  }
  async function sendCode(type: "email-verification" | "sign-in") {
    await authRequest("email-otp/send-verification-otp", { email, type });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      if (stage === "verify" || stage === "email-code") {
        await authRequest(stage === "verify" ? "email-otp/verify-email" : "sign-in/email-otp", { email, otp: code });
        await finish(); return;
      }
      const address = email.trim().toLowerCase();
      if (mode === "signup") {
        const password = String(form.get("password") || "");
        if (password !== String(form.get("confirm") || "")) throw new Error("The passwords do not match.");
        await authRequest("sign-up/email", { name: String(form.get("name") || "").trim(), email: address, password });
        setEmail(address); setStage("verify"); setNotice("A verification code has been sent. Check your inbox to continue.");
      } else if (useCode) {
        await authRequest("email-otp/send-verification-otp", { email: address, type: "sign-in" });
        setEmail(address); setStage("email-code"); setNotice("If an account exists, a sign-in code has been sent.");
      } else {
        await authRequest("sign-in/email", { email: address, password: String(form.get("password") || ""), rememberMe: true });
        await finish();
      }
    } catch (reason) {
      if (reason instanceof AuthRequestError && reason.code === "SIGNUP_ACCOUNT_ALREADY_EXISTS") {
        setStage("details"); setCode(""); setNotice(""); setError(reason.message);
      } else if (reason instanceof AuthRequestError && reason.code === "EMAIL_NOT_VERIFIED") {
        setStage("verify"); setNotice("Verify your email to continue. Check your inbox for a code.");
      } else setError(reason instanceof Error ? reason.message : "Please try again.");
    } finally { setBusy(false); }
  }
  async function resend() {
    setBusy(true); setError("");
    try { await sendCode(stage === "email-code" ? "sign-in" : "email-verification"); setNotice("If eligible, a new code has been sent. Use the latest code."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Please try again."); }
    finally { setBusy(false); }
  }
  async function social(provider: "google" | "facebook") {
    setBusy(true); setError("");
    try {
      const result = await authRequest<{ url?: string }>("sign-in/social", { provider, callbackURL: window.location.origin + destination, errorCallbackURL: window.location.origin + "/account" });
      if (!result.url) throw new Error("The sign-in provider is unavailable.");
      window.location.assign(result.url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Please try again."); setBusy(false); }
  }
  const isOTP = stage !== "details";
  return <section className="section customer-auth-section"><div className="shell customer-auth-layout">
    <aside className="auth-story"><span className="kicker">Your everyday essentials</span><h1>{destination === "/checkout" ? "One quick sign-in. Then back to your cart." : "A little easier, every time you shop."}</h1><p>Books, stationery and thoughtful gifts, all in one happy place.</p><div><ShoppingBag/><span><strong>Your cart stays with you</strong><small>Sign in and continue from where you left off.</small></span></div><div><ShieldCheck/><span><strong>Verified access</strong><small>Only you should have access to your account.</small></span></div><Link href="/shop">Continue browsing <ArrowRight size={16}/></Link></aside>
    <div className="auth-card"><span className="auth-card-icon">{isOTP ? <Mail/> : <LockKeyhole/>}</span>
      <h2>{isOTP ? "Check your email" : mode === "signup" ? "Create your account" : "Welcome back"}</h2>
      <p>{isOTP ? `Enter the 6-digit code sent to ${email}. The code expires in 5 minutes.` : mode === "signup" ? "Create an account and verify your email to start shopping." : "Sign in to continue shopping with Vidyarthi."}</p>
      {method === "email" && methods && !methods.email && <p className="auth-notice" role="status">Email codes are temporarily unavailable. Existing verified accounts can use their password.</p>}
      {!isOTP && <><div className="auth-social"><button disabled={busy || !methods?.google} onClick={() => social("google")}><span>G</span> Continue with Google{methods && !methods.google && <small>Unavailable</small>}</button><button disabled={busy || !methods?.facebook} onClick={() => social("facebook")}><span>f</span> Continue with Facebook{methods && !methods.facebook && <small>Unavailable</small>}</button></div><div className="divider"><span>or continue with</span></div><div className="auth-methods" aria-label="Sign-in method"><button className={method === "email" ? "active" : ""} onClick={() => { setMethod("email"); setError(""); }}>Email</button><button className={method === "phone" ? "active" : ""} onClick={() => { setMethod("phone"); setError(""); }}>Mobile number</button></div></>}
      {method === "phone" ? <CustomerPhoneForm mode={mode} nextPath={destination} available={Boolean(methods?.phone)} /> : <>
      <form onSubmit={submit}>
        {isOTP ? <label>Verification code<input name="otp" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="auth-otp-input" autoFocus /></label> : <>
          {mode === "signup" && <label>Full name<input name="name" autoComplete="name" maxLength={120} required placeholder="Your full name" /></label>}
          <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          {(mode === "signup" || !useCode) && <label>Password<div className="auth-password"><input name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 12 : undefined} maxLength={128} required placeholder={mode === "signup" ? "At least 12 characters" : "Enter your password"}/><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>}
          {mode === "signup" && <><label>Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required placeholder="Repeat your password" /></label><label className="auth-consent"><input type="checkbox" required/><span>I agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</span></label></>}
        </>}
        {error && <p className="auth-error" role="alert">{error}</p>}{notice && <p className="auth-notice" role="status">{notice}</p>}
        <button type="submit" className="button primary" disabled={busy || ((isOTP || mode === "signup" || useCode) ? !methods?.email : !methods?.emailPassword)}>{busy ? "Please wait…" : isOTP ? "Verify and continue" : mode === "signup" ? "Create account" : useCode ? "Send sign-in code" : "Sign in"}</button>
      </form>
      {isOTP ? <div className="auth-bottom"><button type="button" disabled={busy} onClick={resend}>Resend code</button><button type="button" disabled={busy} onClick={() => { setStage("details"); setCode(""); setError(""); setNotice(""); }}><ArrowLeft size={14}/> Change email</button></div> : <>
        {mode === "login" && <div className="auth-bottom"><button disabled={busy} onClick={() => { setUseCode((value) => !value); setError(""); }}>{useCode ? "Use my password instead" : "Sign in with an email code"}</button><Link href={`/forgot-password?next=${encodeURIComponent(destination)}`}>Forgot password?</Link></div>}
        <p className="auth-switch">{mode === "signup" ? "Already have an account?" : "New to Vidyarthi?"} <Link href={`${mode === "signup" ? "/account" : "/register"}?next=${encodeURIComponent(destination)}`}>{mode === "signup" ? "Sign in" : "Create an account"}</Link></p>
      </>}
      </>}
    </div>
  </div></section>;
}
