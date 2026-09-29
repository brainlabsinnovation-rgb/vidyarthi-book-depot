"use client";
import { CheckCircle2 } from "lucide-react";
import { FormEvent, ReactNode, useState } from "react";

export function DemoForm({ children, submitLabel, successTitle, className = "" }: { children: ReactNode; submitLabel: string; successTitle: string; className?: string }) {
  const [sent, setSent] = useState(false);
  function submit(event: FormEvent) { event.preventDefault(); setSent(true); }
  return <form className={className} onSubmit={submit}>{sent && <div className="demo-success customer-success"><CheckCircle2 /><span><strong>{successTitle}</strong><small>Preview complete. No information was sent.</small></span></div>}{children}<button className="button primary" type="submit">{submitLabel}</button></form>;
}
