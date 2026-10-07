"use client";
import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { CustomerPhoneForm } from "./customer-phone-form";
export function CustomerPhoneRecovery({ nextPath }: { nextPath: string }) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/store/auth-config", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((methods) => setAvailable(Boolean(methods.phone))).catch(() => {});
    return () => controller.abort();
  }, []);
  return <section className="section customer-auth-section"><div className="shell"><div className="auth-card auth-reset-card">
    <span className="auth-card-icon"><Smartphone /></span><h1>Recover your phone account</h1>
    <p>Verify your registered mobile number to choose a new password.</p>
    <CustomerPhoneForm mode="login" nextPath={nextPath} available={available} recovery />
  </div></div></section>;
}
